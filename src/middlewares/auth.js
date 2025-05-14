const jwt=require('jsonwebtoken');
const User=require('../models/user.model');

const UserMw=async(req,res,next)=>{

    try {
        const {token}=req.cookies;
    
        if(!token){
            res.status(401).send("Unable to get token");
        }
    
        else{
            const verifyDecodedToken=jwt.verify(token,"umer1234");
            console.log(verifyDecodedToken);
          
            if(!verifyDecodedToken){
                res.status(401).send("Failed to verify token");
            }
            const user=await User.findById(verifyDecodedToken._id);
            if(!user){
                res.status(401).send("Unable to get user");
            }
            req.user=user;
            next();
        }
    } catch (error) {
        res.status(500).send(error.message);
        
    }
}

    module.exports = {
   
    UserMw,
    // other middleware functions...
}