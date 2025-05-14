// const mongoose = require('mongoose');

// const User=require('./user.model')


// const messageSchema=new mongoose.Schema({
//     sender:{
//         type:mongoose.Schema.Types.ObjectId,
//         ref:User,
//         required:true
//     },
   
//     text:{
//         type:String,
//         required:true

//     }

// },{timestamps:true})

// const chatSchema=new mongoose.Schema({
//     paticipants:[{
//         type:mongoose.Schema.Types.ObjectId,
//         ref:User,
//         required:true
//     }],
//     messages:[messageSchema]

// },{
//     timestamps:true
// });


// module.exports=mongoose.model("Chat",chatSchema);





const mongoose = require("mongoose");
const User = require("./user.model");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const chatSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    messages: [messageSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chat", chatSchema);