const express = require('express');
const User = require('../models/user.model');
const bcrypt = require('bcrypt');
const { validateUser } = require('../utils/validate');
const upload = require("../middlewares/upload");
const cloudinary = require('../config/cloudinary');
const jwt = require('jsonwebtoken');

const authRouter = express.Router();

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "umer1234");
    const user = await User.findById(decoded._id).select('-password');
    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// Validate Token
authRouter.get('/user/validate', verifyToken, async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Signup
authRouter.post("/user/signup", upload.single('profilePic'), async (req, res) => {
  try {
    const { fullname, email, password, role, category, skills } = req.body;
    let profilePicUrl = null;

    if (!req.file) {
      throw new Error("Profile picture is required");
    }

    if (!req.file.buffer || req.file.buffer.length === 0) {
      throw new Error("Uploaded file is empty. Please select a valid image.");
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'profile_pics', resource_type: 'image' },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(new Error('Failed to upload to Cloudinary: ' + error.message));
          } else {
            resolve(result);
          }
        }
      );
      stream.end(req.file.buffer);
    });

    profilePicUrl = uploadResult.secure_url;

    const isUserExists = await User.findOne({ email });
    if (isUserExists) {
      throw new Error("User already registered");
    }

    if (!profilePicUrl) {
      throw new Error("Profile picture upload failed");
    }

    if (!category) {
      throw new Error("Category is required");
    }

    if (!skills) {
      throw new Error("Skills are required");
    }

    const hashpassword = await bcrypt.hash(password, 10);

    const skillsArray = skills.split(',').map(skill => skill.trim());

    const newUser = new User({
      fullname,
      email,
      password: hashpassword,
      role,
      profilePic: profilePicUrl,
      category,
      skills: skillsArray,
    });

    await newUser.save();

    res.json({
      message: "User created successfully",
      data: { user: newUser },
    });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(400).send({ message: err.message });
  }
});

// Login
authRouter.post("/user/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new Error("Invalid credentials");
    }
    const isValidPassword = await user.validateJwt(password);

    if (!isValidPassword) {
      throw new Error("Invalid credentials");
    }

    const token = await user.getJwt();
    res.cookie("token", token, { httpOnly: true });

    res.send(user);
  } catch (err) {
    res.status(400).send("Something went wrong: " + err.message);
  }
});

// Logout
authRouter.post('/user/logout', (req, res) => {
  res.clearCookie('token');
  res.send({
    message: "Logged Out"
  });
});

// Update Profile
authRouter.put("/user/profile", verifyToken, upload.single('profilePic'), async (req, res) => {
  try {
    const { fullname, location, about, category, skills } = req.body;
    let profilePicUrl = req.user.profilePic;

    if (req.file) {
      if (!req.file.buffer || req.file.buffer.length === 0) {
        throw new Error("Uploaded file is empty. Please select a valid image.");
      }

      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'profile_pics', resource_type: 'image' },
          (error, result) => {
            if (error) {
              console.error('Cloudinary upload error:', error);
              reject(new Error('Failed to upload to Cloudinary: ' + error.message));
            } else {
              resolve(result);
            }
          }
        );
        stream.end(req.file.buffer);
      });

      profilePicUrl = uploadResult.secure_url;
    }

    if (!fullname) {
      throw new Error("Full name is required");
    }
    if (!category) {
      throw new Error("Category is required");
    }
    if (!skills) {
      throw new Error("Skills are required");
    }

    const skillsArray = skills.split(',').map(skill => skill.trim());

    const updateData = {
      fullname,
      location,
      about,
      category,
      skills: skillsArray,
      profilePic: profilePicUrl,
    };

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    res.json({
      message: "Profile updated successfully",
      data: { user: updatedUser },
    });
  } catch (err) {
    console.error("Profile update error:", err.message);
    res.status(400).json({ message: err.message });
  }
});

module.exports = authRouter;