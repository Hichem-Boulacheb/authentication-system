import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import encrypt from "mongoose-encryption";
import dotenv from "dotenv";
import md5 from "md5";
dotenv.config();
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import passportLocalMongoose from "passport-local-mongoose";
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import findOrCreate from "mongoose-findorcreate";
const saltRounds = 10;



const app=express();
const port=3000;
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended:true}));
app.use(session({
    secret:process.env.SECRET,
    resave:false,
    saveUninitialized:false,
   // cookie: { maxAge: 24 * 60 * 60 * 1000 },
}))
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(DB_URL);

const userSchema=new mongoose.Schema({
    username:String,
    password:String,
    googleId:String,
    secrets:[String],
})

// userSchema.plugin(encrypt,{secret: process.env.SECRET,encryptedFields:['password']});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const user=mongoose.model("users",userSchema);

passport.use(user.createStrategy());
//from passport-local-mongoose
// passport.serializeUser(user.serializeUser());
// passport.deserializeUser(user.deserializeUser());
//when using passport-local-mongoose , you can use these methods, serialize create the cookie and the session , and deserialize detroy it 
//from passport documentation work in any case
passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, {
        id: user.id,
        username: user.username,
        picture: user.picture
      });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  })

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
  },
  function(accessToken, refreshToken, profile, cb) {
    user.findOrCreate({ googleId: profile.id }, function (err, user) {
        
      return cb(err, user);
    });
  }
));

app.get("/",async(req,res)=>{
    if(req.isAuthenticated()){
        const u=await user.findOne({_id:req.user.id});
        if(u.secrets.length==0){
            res.render("secrets.ejs");
        }else{
            res.render("secrets.ejs",{secrets:u.secrets});
        }
    }else{
        res.render("home.ejs")
    }
})
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] }));
app.get("/login",(req,res)=>{
    res.render("login.ejs");
})

app.get("/auth/google/secrets", 
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect secrets page.
    res.redirect("/secrets");
  });
app.get("/register",(req,res)=>{
    res.render("register.ejs");
})
// using bcrypt
// app.post("/register",(req,res)=>{
//     bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
//         const new_user=new user({
//             username:req.body.username,
//             password:hash,
//         })
//         new_user.save();
//         if(err){
//             console.log(err)
//         }else{
//             res.render("secrets.ejs"); 
//         }
//     });

    
// })
// app.post("/login",async(req,res)=>{
//     const username=req.body.username;
//     const password=req.body.password;
//     const user_found=await user.findOne({username:username});
//     if(user_found){
//         bcrypt.compare(password,user_found.password, function(err, result) {
//             if(result===true){
//                 res.render("secrets.ejs");
//             }else{
//                 res.render("login.ejs");
//             }
//         });
//     }else{
//         res.render("login.ejs")
//     }
// })
//using passport.js

app.post("/register",(req,res)=>{
    user.register({username:req.body.username,secrets:[]},req.body.password,(err,user)=>{
        if(err){
            console.log(err);
            res.redirect("/register");
        }else{
            passport.authenticate("local")(req,res,()=>{
                res.redirect("/secrets");
            })
        }
    })
})
app.post("/login",(req,res)=>{
    const user_typed=new user({
        username:req.body.username,
        passowrd:req.body.password,
    })
        req.login(user_typed,(err)=>{
            if(err){
                console.log(err);
                res.redirect("/login")
            }else{
                passport.authenticate("local",(err,user)=>{
                    if(err){
                        console.log(err);
                        res.redirect("/login")
                    }else{
                        if(!user){
                            res.redirect("/login")
                        }else{
                            res.redirect("/secrets")
                        }
                    }
                })(req,res,()=>{
                    res.redirect("/secrets")
                })
            }
        })
})
app.get("/secrets",async(req,res)=>{
    if(req.isAuthenticated()){
        const u=await user.findOne({_id:req.user.id});
        if(u.secrets.length==0){
            res.render("secrets.ejs");
        }else{
            res.render("secrets.ejs",{secrets:u.secrets});
        }
    }else{
        res.render("login.ejs")
    }
})
app.get("/submit",async(req,res)=>{
    if(req.isAuthenticated()){
        res.render("submit.ejs");
    }else{
        res.render("login.ejs")
    }
})
app.get("/logout",(req,res)=>{
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect('/');
      });
})
app.post("/submit",async(req,res)=>{
    const id=req.user.id;
    const secret=req.body.secret;
    const u=await user.findOne({_id:id});
    u.secrets.push(secret);
    u.save();
    res.redirect("/secrets");
})


app.listen(port,()=>{
    console.log("your server is running on port "+ port);
})
