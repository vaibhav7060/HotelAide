require('dotenv').config();
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const {GridFsStorage} = require('multer-gridfs-storage');
const Grid = require("gridfs-stream");
const methodOverride = require("method-override");
const bodyParser = require("body-parser"); 
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate")

const app = express();
app.set('view engine', 'ejs');

app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
// mongoose.set('strictQuery', false);
//app.use(express.static(path.join(__dirname, './public/')));

// Javascript for login, sign-up and oAuth starts here
app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

const mongoURI = 'mongodb+srv://Darshan_Mudbasal:darshan@25-19@cluster0.zkb4qjf.mongodb.net/userDB?retryWrites=true&w=majority';
const conn = mongoose.createConnection(mongoURI, {
  useNewUrlParser: true,
  useCreateIndex: true,
  useUnifiedTopology: true,
  useFindAndModify: false
});

mongoose.connect("mongodb+srv://Darshan_Mudbasal:darshan@25-19@cluster0.zkb4qjf.mongodb.net/userDB?retryWrites=true&w=majority", {useNewUrlParser: true});


const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new  mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done){
  done(null, user.id);
});

passport.deserializeUser(function(id, done){
  User.findById(id, function(err, user){
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/review",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));





app.get("/log-in", function(req, res){
  res.render("log-in");
});

app.get("/sign-up", function(req, res){
  res.render("sign-up");
});

app.route("/auth/google")

  .get(passport.authenticate("google", {

    scope: ["profile"]

  }));

  app.get("/auth/google/review",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/review");
  });

app.get("/", function(req, res){
  res.render("index", {presentyear: date});
});

// app.get("/review", function(req,res){
//   if(req.isAuthenticated()){
//     res.render("review");
//   } else {
//     res.redirect("/log-in");
//   }
// });

app.post("/sign-up", function(req,res){
  User.register({username: req.body.username}, req.body.password, function(err, user){
    if(err){
      console.log(err);
      res.redirect("/sign-up");
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/review");
      });
    }

  });
});

app.post("/log-in", function(req,res){

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  req.login(user, function(err){
    if(err){
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/review");
      });
    }
  });
});

// Javascript for login, sign-up and oAuth ends here

// const mongoURI = 'mongodb+srv://Darshan_Mudbasal:darshan@25-19@cluster0.zkb4qjf.mongodb.net/userDB?retryWrites=true&w=majority';
// const conn = mongoose.createConnection(mongoURI, {
//   useNewUrlParser: true,
//   useCreateIndex: true,
//   useUnifiedTopology: true,
//   useFindAndModify: false
// });
//mongoose.connect("mongodb://127.0.0.1:27017/userDB", {useNewUrlParser: true});

let date = new Date().getFullYear();

let posts;

let gfs, gridfsBucket;

const postSchema = {
  name: String,
  hotel: String,
  address: String,
  star: String,
  image: Buffer,
  userexperience: String
};

const Post = mongoose.model("Post", postSchema);


conn.once("open",() => {
  gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
        bucketName: "upload"
      });
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("upload");
});

const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if(err) {
          return reject(err);
        }
        const filename = buf.toString("hex") + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: "upload"
        };
        resolve(fileInfo);
      });
    });
  }
});
const upload = multer({storage});

app.post("/review", (req, res) => {
  const post = {
    name: req.body.userName,
    hotel: req.body.hotelName,
    address: req.body.hotelAddress,
    star: req.body.rating,
    userexperience: req.body.experience
  };
  //res.json({ file: req.file});
  res.redirect("/content");
  post.updateOne();

});

app.get("/privacy", function(req, res){
  res.render("privacy");
});

app.get("/terms", function(req, res){
  res.render("terms");
});

app.get("/community", function(req, res){
  res.render("community");
});

app.get("/content", function(req, res){
  Post.find({}, function(err, posts){
    res.render("content", {
      posts: posts
      });
  });
  gfs.files.find().toArray((err, files) => {
    // Check if files
    if (!files || files.length === 0) {
      res.render("content", {files: false});
    } else {
      files.map(file => {
        if(file.contentType === "image/jpeg" || file.contentType === "image/png"){
          file.isImage = true;
        }else{
          file.isImage = false;
        }
      });
      res.render("content", {files: files});
    }
  });

});

app.get("/content", function(req, res){
  res.render("content", {posts: posts});
});

app.get("/review", function(req, res){
  res.render("review");
});

//@route GET /files
//@desc  Display all files in JSON
app.get("/files", (req, res) => {
  gfs.files.find().toArray((err, files) => {
    // Check if files
    if (!files || files.length === 0) {
      return res.status(404).json({
        err: "No files exist"
      });
    }

    // Files exist
    return res.json(files);
  });
});

app.get("/files/:filename", (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    // Check if file
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: "No file exists"
      });
    }
    // File exists
    return res.json(file);
  });
});

// @route GET /image/:filename
// @desc Display Image
app.get("/image/:filename", (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    // Check if file
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: "No file exists"
      });
    }

    // Check if image
    if (file.contentType === "image/jpeg" || file.contentType === "image/png") {
      // Read output to browser
      const readstream = gridfsBucket.openDownloadStreamByName(file.filename);
      readstream.pipe(res);
    } else {
      res.status(404).json({
        err: "Not an image"
      });
    }
  });
});



// Server setup
app.listen(3000, function(req, res) {
  console.log("Connected on port:3000");
});
