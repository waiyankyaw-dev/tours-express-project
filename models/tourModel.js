const mongoose = require('mongoose');
const slugify = require('slugify');
// const User = require('./userModel');
// const validator = require('validator');

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      maxlength: [40, 'A tour name must have less or equal than 40 characters'],
      minlength: [10, 'A tour name must have more or equal than 10 characters']
      //  : [validator.isAlpha, 'Tour name must only contain characters']
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration']
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size']
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium, difficult'
      }
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      set: val => Math.round(val * 10) / 10 //this fun will run each time a new value is set
    },
    ratingsQuantity: {
      type: Number,
      default: 0
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price!']
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function(val) {
          //this only points to current doc on NEW document creation(not run in update time)
          return val < this.price;
        },
        message: 'Discount price ({VALUE}) should be below regular price'
      }
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a description']
    },
    description: {
      type: String,
      trim: true
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image']
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false
    },
    startLocation: {
      //GeoJSON
      //type must be String that may be 'Point','MultiPoint','MultiLineString','Polygon',etc....
      type: {
        type: String,
        default: 'Point',
        enum: ['Point']
      },
      coordinates: [Number],
      address: String,
      description: String
    },
    locations: [
      //must be an array to be an embedded document
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point']
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number
      }
    ],
    // guides: Array(for embedding)  //not recommend for a lot of creating(good for fetching)

    //child referencing(not recommend for fetching and must not be a lot of data)
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User' //user collection or table
      }
    ]
  },
  {
    //virtuals show in Both Json and object outputs
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

//for filter(search)
//we don't want to set indexs for all the fields because total size will be bigger(not good for high write/read)
tourSchema.index({ price: 1, ratingsAverage: -1 }); //1=ascending , 0 = descending
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere' });

//only see in response(fetchedData)
tourSchema.virtual('durationWeeks').get(function() {
  return this.duration / 7;
});

//tours is parent referencing to connect child we can connect manually or child referencing but I don't know how large data will be in the future
// Virtual populate(it will query really to reference model but not put in database)we populated in controller. if we didn't populate,we would get null
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id' //look for the _id of the tour in the tour field in review
});

//DOCUMENT MIDDLEWARE: runs before .save() and .create() (not run in update time)
tourSchema.pre('save', function(next) {
  // console.log(this);
  this.slug = slugify(this.name, { lower: true });
  next();
});

//Embedding users but we will use reference in this project
// tourSchema.pre('save', async function(next) {
//   const guidesPromises = this.guides.map(async id => await User.findById(id)); //the result is promises so you need to use promise.all()
//   this.guides = await Promise.all(guidesPromises); //replace docs instead of ids
//   next();
// });

// tourSchema.pre('save', function(next) {
//   console.log('Will save document...');
//   next();
// });

// tourSchema.post('save', function(doc, next) {
// console.log(doc);
//   next();
// });

// QUERY MIDDLEWARE
//if we use the fun related to query in controller,there will be a lot so use here is a best idea

tourSchema.pre(/^find/, function(next) {
  //this refers to query object
  this.find({ secretTour: { $ne: true } });
  this.start = Date.now();
  next();
});

tourSchema.pre(/^find/, function(next) {
  //this refers to query object
  this.populate({
    //populate is kinda query so if you read so many times,we recommend using embedding
    path: 'guides',
    select: '-__v -passwordChangedAt'
  });
  next();
});

tourSchema.post(/^find/, function(docs, next) {
  console.log(`Query took ${Date.now() - this.start} milliseconds!`);
  // console.log(docs);
  next();
});

// AGGREGATION MIDDLEWARE

// tourSchema.pre('aggregate', function(next) {
//   // console.log(this.pipeline());
//   this.pipeline().unshift({ $match: { secretTour: { $ne: true } } });
//   next();
// });

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
