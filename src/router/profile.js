const express=require('express');
const {UserMw}=require('../middlewares/auth');
const {validateFields}=require('../utils/validate');
const bcrypt=require('bcrypt');

const profileRouter=express.Router();

profileRouter.get("/user/profile/view",UserMw, async (req, res) => {
    try {
        // User is now available on req.user
        res.status(200).send(req.user);
    } catch (error) {
        res.status(500).send("An error occurred");
    } 
});



//edit the profile of the current loggedIn user
//steps
//1)get the current user  (how?) ->req.cookies -> req.body sa req.cookie ki fields ko updae kro -> save kra doo

profileRouter.patch('/user/profile/edit',UserMw,async(req,res)=>{
    try{
        //1) get the current user

        const user=req.user;

        console.log(user);

        // const validateFields=validateFields(req.body);
        // console.log('validateFields',validateFields);

        if(validateFields(req)){
            throw new Error('Invalid fields');
        }

        console.log("pee");




        //2) update the user fields
        Object.keys(req.body).forEach((key)=>{
            user[key]=req.body[key];
        });
        //3) save the user
        await user.save();

        res.status(201).json({
            message: "User saved successfully",
            data:{
                user: user
            }
        });
        //4) return the updated user
    }
    catch(err){
        res.status(500).send('Server Error'+err.message);
    }
});



profileRouter.patch('/user/profile/editpassword',UserMw,async(req,res)=>{
    const user=req.user;

    if(!validateFields(req)){
        throw new Error('Invalid fields'); 
    }
   
    password=req.body.password;
    const hashpassword=await bcrypt.hash(password,10);
    user.password=hashpassword;


    user.save();
    res.json({
        message: "Password updated successfully",
        data:{
            user: user
        }
    })
})


module.exports= profileRouter;