const express=require('express');
const { UserMw } = require('../middlewares/auth');
const requestRouter = express.Router();
const ConnectionRequest= require('../models/request.model');
const User= require('../models/user.model');

requestRouter.post('/user/request/:status/:touserid',UserMw, async(req,res)=>{
    try {
        const {status,touserid}=req.params;
      
        if(!status || !touserid){
            return res.status(400).send("Missing parameters");
        }

        //validate status
        const allowedStatus=["interested","notinterested"];
        if(!allowedStatus.includes(status)){
            return res.status(400).send("Invalid status");
        }

        const senderId=req.user._id;
      

        if(!senderId){
            throw new Error("Unable to fetch sender");
        }


        //request to an unknown case
        const allowedUserIds= await User.findOne({ _id:touserid});
       


        if(!allowedUserIds){
            throw new Error("Invalid sender");
        }

         //same senderID==recieverid

         if(senderId.equals(touserid)){
            throw new Error("Invalid sender and receiver");
        }



        //check if the request alreaddy exists

        const checkingRequestInDb= await ConnectionRequest.findOne({
            $or: [{sender:senderId,reciever:touserid},
                {sender:touserid,reciever:senderId}
            ]
    });
  

        if(checkingRequestInDb){
            throw new Error("Request already exists");
        }


        const senderFirstName=req.user.firstName;

        const recieverFirstName=allowedUserIds.firstName;



        //sending data to the db
        const connectionRequest =new ConnectionRequest({
            sender:senderId,
            reciever:touserid,
            status:status
        });

        await connectionRequest.save();

        res.status(201).json({
            message: `${senderFirstName}  sending request to ${recieverFirstName}`,
            data:{
                status,
                touserid,
                senderId
            }
        })

        
    } catch (error) {
        res.status(500).send(error.message);
        
    }
});

requestRouter.post('/user/request/review/:status/:request',
    UserMw,
     async(req,res)=>{
    try{
        const loggedInuser= req.user;
        const {status,request}=req.params;

        //status validity
        allowedstatus=["accepted","rejected"];
        if(!allowedstatus.includes(status)){
            throw new Error("Invalid status");
        }



        // if(loggedInuser?._id!=request?.reciever){
        //     throw new Error('Invalid connection request')
        // }
        //request validity

        console.log("iee")
        checkRequest=await ConnectionRequest.findOne({_id:request,
            status:"interested",
            reciever:loggedInuser._id
        });
        console.log(checkRequest);
        
        checkRequest.status=status;
        console.log("oee")
        await checkRequest.save();

        res.status(202).json({
            message:` request`,
            data:{
                checkRequest
            }
        })

    }
    catch(error){
        res.status(500).json({
            message:error.message
        });
    }
})

module.exports=requestRouter;