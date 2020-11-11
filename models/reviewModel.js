const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review can not be empty!']
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    //parent refercing so no need array
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour.']
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user']
    }
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

reviewSchema.index({ tour: 1, user: 1 }, { unique: true }); // 1 or -1 not important in this case

//it queries two times so not for fetching again and again
reviewSchema.pre(/^find/, function(next) {
  //that makes inefficient chains of populates
  // this.populate({
  //   path: 'tour',
  //   select: 'name'
  // }).populate({
  //   path: 'user',
  //   select: 'name photo'
  // });
  //we want only have review avaliable on tours,not tours avaliable on reviews
  this.populate({
    path: 'user',
    select: 'name photo'
  });
  next();
});

reviewSchema.statics.calcAverageRatings = async function(tourId) {
  //this in statics method always points to current model,that's why we use statics method
  // console.log(tourId);
  const stats = await this.aggregate([
    {
      $match: { tour: tourId } //tourId will not match if we deleted all reviews on that tour so u will get empty array
    },
    {
      $group: {
        _id: '$tour',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' }
      }
    }
  ]);
  // console.log(stats);

  //after deleting all reviews on related tour,it will get error,that's why put default value
  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5
    });
  }
};

reviewSchema.post('save', function() {
  //this points to current document(review)
  //this.consturctor = Model
  this.constructor.calcAverageRatings(this.tour);
});

reviewSchema.pre(/^findOneAnd/, async function(next) {
  //this can only use before query(not works in post)
  this.r = await this.findOne(); //(By the time Only searched not Update  or Delete yet)
  //r(review) is old data
  // console.log(this.r);
  next();
});

reviewSchema.post(/^findOneAnd/, async function(next) {
  //await this.findOne(); does NOT work here, query has already executed
  await this.r.constructor.calcAverageRatings(this.r.tour);
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
