const express=require('express');
const { UserMw } = require('../middlewares/auth');
const Chat=require('../models/Chat.model')
const mongoose = require('mongoose');
const ConnectionRequest = require('../models/request.model');

const chatRouter=express.Router();


// chatRouter.get("/user/chat/:trargetUserId",UserMw,async(req,res)=>{
//  try {
//        const sender=req.user._id;
//        const reciever=req.params.trargetUserId;


//        console.log("sender"+ sender);
//        console.log("reciever"+ reciever);
   
//        let chatdekhbhai=await Chat.findOne({
//            participants:{$all:[sender,reciever]}
   
//        }).populate({
//         path:"messages.sender",
//         select:"firstName lastName"
//        });
   
//        if(!chatdekhbhai || chatdekhbhai.length === 0){
//            chatdekhbhai=await new Chat({
//                paticipants:[sender,reciever],
//                messages:[]
//            });
   
//            await chatdekhbhai.save()
//        };
   
//        res.send({
//            message:"Got chat",
//           data:chatdekhbhai
           
//        })
//  } catch (error) {
//     res.send({data:error.message});
    
//  }
//  });



chatRouter.post("/user/chat/:trargetUserId", UserMw, async (req, res) => {
  try {
    const sender = req.user._id;
    const reciever = req.params.userId; // Extract the target user ID

 

    // const verify = await ConnectionRequest.findOne({
    //     $or: [
    //       { sender, reciever , status: "accepted" },
    //       { reciever, sender  ,status: "accepted"},
    //     ],
    //     // Only accept requests that have been accepted
    //   });

      

      // if(!verify){
      //   throw new Error("No active connection found between users");
      // }
      // if(verify){
    



    let chatdekhbhai = await Chat.find({
      paticipants: { $all: [sender, reciever] },
    })

    

    if (chatdekhbhai.length === 0) {
      // If no chat exists, create a new one
      chatdekhbhai = await new Chat({
        paticipants: [sender, reciever], // Fixed: Remove object wrapping
        messages: [],
      });


      console.log(chatdekhbhai.paticipants);
     

      await chatdekhbhai.save(); // Save the new chat
    }

    res.send({
      message: "Got chat",
      data: chatdekhbhai,
    });
  } catch (error) {
    res.send({ data: error.message });
  }
});


module.exports=chatRouter;

