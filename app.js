const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const compression = require('compression');
const cors = require('cors');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const bookingController = require('./controllers/bookingController');
const viewRouter = require('./routes/viewRoutes');

const app = express();

//for https
app.enable('trust proxy');

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views')); //we don't need to worry about path(/views),node will automatically create with this package

//Serving static files
// app.use(express.static(`${__dirname}/public`));
app.use(express.static(path.join(__dirname, 'public'))); //request image or css files in asset,etc...

// 1) GLOBAL MIDDLEWARES
//Implement CORS
//Access-Control-Allow-Origin
app.use(cors());
// api.natours.com,front-end natours.com
// app.use({
//   origin: 'https://www.natours.com'
// });

app.options('*', cors());
// only tours could be deleted or patched from cors,none of other resources
// app.options('/api/v1/tours/:id', cors());

//please put helmet at the beginning
//Set security HTTP headers
app.use(helmet()); //helmet returns a function that's why you don't need to worry about fun call
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'", 'https:', 'http:', 'data:', 'ws:'],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https:', 'http:', 'data:'],
      scriptSrc: ["'self'", 'https:', 'http:', 'blob:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:', 'http:'],
      imgSrc: ["'self'", 'data:', 'blob:']
    }
  })
);

// console.log(process.env.NODE_ENV);
//Development Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

//Limit requests from same API
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'To many requests from this IP,please try again in an hour!'
});
app.use('/api', limiter);

// Stripe webhook, BEFORE body-parser, because stripe needs the body as stream
app.post(
  '/webhook-checkout',
  bodyParser.raw({ type: 'application/json' }),
  bookingController.webhookCheckout
);

//Body parser,reading data from body into req.body
app.use(express.json({ limit: '10kb' }));

//Body parser for form data(urlEncoded)
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

//By the way they are third-party middlewares
//parse data from cookie
app.use(cookieParser());

//Data sanitization against NOSQL query injection
app.use(mongoSanitize()); //that will remove all $ in req.body

//mongoose Schema also protect XSS attack in server side
//Data sanitization against XSS
app.use(xss()); //clean any user input from malicious HTML code

//prevent parameter pollution(if we input two sort,it will only take the last one)
//whitelist allow duplication
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price'
    ]
  })
);

//only for text,for images,they already compressed like jpg
app.use(compression());

//my own middleware😁
// app.use((a, b, next) => {
//   console.log('wai');
//   next();
// });

//express middlewares,not third party middlewares
//testing middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.headers);
  next();
});

// 3) ROUTES
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/bookings', bookingRouter);
app.use('/api/v1/reviews', reviewRouter);

//this must be the last route
app.all('*', (req, res, next) => {
  // const err = new Error(`Can't find ${req.originalUrl} on this server`);
  // err.status = 'fail';
  // err.statusCode = 404;
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

//to catch all errors within middlewares
app.use(globalErrorHandler);

module.exports = app;
