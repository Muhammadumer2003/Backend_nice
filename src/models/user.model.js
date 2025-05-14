const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  fullname: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
  },
  role: {
    type: String,
    default: "Freelancer",
    enum: ["Freelancer", "client"],
  },
  profilePic: {
    type: String,
    required: true, // Mandatory field for profile picture path
    trim: true,
  },
  category: {
    type: String,
    required: true, // Mandatory field for user category
    trim: true,
  },
  skills: {
    type: [String], // Array of skills
    required: true, // Mandatory field
    trim: true,
  },
}, { timestamps: true });

// Method to validate password using bcrypt
userSchema.methods.validateJwt = async function (ispassword) {
  const user = this;
  const jwtSigned = await bcrypt.compare(ispassword, user.password);
  if (!jwtSigned) {
    throw new Error("Invalid credentials");
  }
  return true;
};

// Method to generate JWT token
userSchema.methods.getJwt = async function () {
  const user = this;
  const token = jwt.sign({ _id: user._id }, "umer1234"); // Consider using an environment variable for the secret
  return token;
};

const User = mongoose.model('User', userSchema);
module.exports = User;