// const mongoose = require('mongoose');

// const jobSchema = new mongoose.Schema({
//   jobTitle: { type: String, required: true },
//   jobDescription: { type: String, required: true },
//   jobType: { type: String, enum: ['Hourly', 'Fixed Price'], required: true },
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true,
//   },
//   budget: { type: Number, required: true },
//   status: {
//     type: String,
//     enum: ['Ongoing', 'Completed'],
//     default: 'Ongoing', // Default to "Ongoing" when a job is created
//   },
// }, { timestamps: true });

// module.exports = mongoose.model('Job', jobSchema);


const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true }, // Changed from jobTitle to match frontend
  description: { type: String, required: true }, // Changed from jobDescription
  jobType: { type: String, enum: ['hourly', 'fixed'], required: true }, // Changed to lowercase to match frontend
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  budget: { // Dynamic budget structure
    type: mongoose.Schema.Types.Mixed,
    required: true,
    validate: {
      validator: function (value) {
        if (this.jobType === 'hourly') {
          return value.min && value.max && value.min <= value.max;
        } else if (this.jobType === 'fixed') {
          return typeof value.fixed === 'number';
        }
        return false;
      },
      message: 'Invalid budget format for the specified job type',
    },
  },
  status: {
    type: String,
    enum: ['Ongoing', 'Completed'],
    default: 'Ongoing',
  },
  category: { type: String, required: true },
  subCategory: { type: String, default: '' },
  experienceLevel: {
    type: String,
    enum: ['entry', 'intermediate', 'expert'],
    default: 'entry',
  },
  projectScope: {
    type: String,
    enum: ['small', 'medium', 'large'],
    default: 'small',
  },
  duration: {
    type: String,
    enum: ['less_than_1_month', '1_to_3_months', '3_to_6_months', 'more_than_6_months'],
    default: 'less_than_1_month',
  },
  skills: [{ type: String }],
  location: { type: String, default: 'worldwide' },
  languages: [{ type: String }],
  screeningQuestions: [{ type: String }],
  attachments: [{ type: String }], // Store Cloudinary URLs
}, { timestamps: true });

module.exports = mongoose.model('Job', jobSchema);