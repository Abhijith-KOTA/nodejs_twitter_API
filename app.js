const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbpath = path.join(__dirname, "twitterClone.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
};

initializeDBAndServer();

// MIDDLEWARE ### TO AUTHENTICATE JWT TOKEN

const authenticateToken = async (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "udaynikhwify", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// POST ### NEW USER REGISTRATION API 1
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const checkNewUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(checkNewUserQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const createNewuserQuery = `INSERT INTO user(name, username, password, gender) 
                VALUES ('${name}','${username}','${hashedPassword}','${gender}');`;
      await db.run(createNewuserQuery);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// POST ### LOGIN API 2

app.post("/login/", async (request, response) => {
  const { password, username } = request.body;
  const checkNewUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(checkNewUserQuery);
  if (dbUser !== undefined) {
    const isCorrectPassword = await bcrypt.compare(password, dbUser.password);
    if (isCorrectPassword) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "udaynikhwify");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

// GET ### latest tweets of people whom the user follows API 3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  console.log(getUserId);
  const getUserFollowingUserIdQuery = `SELECT following_user_id from follower WHERE follower_user_id = ${getUserId.user_id};`;
  const userFollowingIds = await db.all(getUserFollowingUserIdQuery);
  console.log(userFollowingIds);
  const idsArray = userFollowingIds.map((eachUser) => {
    return eachUser.following_user_id;
  });
  console.log(idsArray);

  const getTweetQuery = `select user.username, tweet.tweet, tweet.date_time as dateTime 
            from user inner join tweet 
                on user.user_id= tweet.user_id where user.user_id in (${idsArray})
            order by tweet.date_time desc limit 4 ;`;
  const dbresponse = await db.all(getTweetQuery);
  response.send(dbresponse);
});

// GET ### returns people whom the user follows API 4
app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  console.log(getUserId);
  const getUserFollowingUserIdQuery = `SELECT following_user_id from follower WHERE follower_user_id = ${getUserId.user_id};`;
  const userFollowingIds = await db.all(getUserFollowingUserIdQuery);
  console.log(userFollowingIds);
  const idsArray = userFollowingIds.map((eachUser) => {
    return eachUser.following_user_id;
  });
  console.log(idsArray);

  const getTweetQuery = `select name from user where user_id in (${idsArray});`;
  const dbresponse = await db.all(getTweetQuery);
  response.send(dbresponse);
});

// GET ### returns people who follows the user API 5
app.get("/user/followers/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  console.log(getUserId);
  const getUserFollowingUserIdQuery = `SELECT follower_user_id from follower WHERE following_user_id = ${getUserId.user_id};`;
  const userFollowingIds = await db.all(getUserFollowingUserIdQuery);
  console.log(userFollowingIds);
  const idsArray = userFollowingIds.map((eachUser) => {
    return eachUser.follower_user_id;
  });
  console.log(idsArray);

  const getTweetQuery = `select name from user where user_id in (${idsArray});`;
  const dbresponse = await db.all(getTweetQuery);
  response.send(dbresponse);
});

// GET ### returns tweet, likes count replies count  API 6
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  let { username } = request;
  const { tweetId } = request.params;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  console.log(getUserId);
  const getUserFollowingUserIdQuery = `SELECT following_user_id from follower WHERE follower_user_id = ${getUserId.user_id};`;
  const userFollowingIds = await db.all(getUserFollowingUserIdQuery);
  console.log(userFollowingIds);
  const idsArray = userFollowingIds.map((eachUser) => {
    return eachUser.following_user_id;
  });
  console.log(idsArray);
  const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${idsArray});`;
  const getTweetIdsArray = await db.all(getTweetIdsQuery);
  const tweetIdsArray = getTweetIdsArray.map((eachTweet) => {
    return eachTweet.tweet_id;
  });
  console.log(tweetIdsArray);
  if (tweetIdsArray.includes(parseInt(tweetId))) {
    const getCountsQuery = `select  tweet,  count(distinct like_id) as likes,  count(distinct reply_id) as replies, tweet.date_time as dateTime from (reply inner join like
            on reply.tweet_id=like.tweet_id) as T inner join tweet on tweet.tweet_id = T.tweet_id where tweet.tweet_id=${tweetId};`;
    const getTweetAndCountsArray = await db.get(getCountsQuery);

    console.log(getTweetAndCountsArray);
    response.send(getTweetAndCountsArray);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

const convertLikedUserNameDBObjectToResponseObject = (dbObject) => {
  return {
    likes: dbObject,
  };
};
// GET ### returns who liked the tweet API 7
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    let { username } = request;
    const { tweetId } = request.params;
    const getUserIdQuery = `select user_id from user where username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);
    console.log(getUserId);
    const getUserFollowingUserIdQuery = `SELECT following_user_id from follower WHERE follower_user_id = ${getUserId.user_id};`;
    const userFollowingIds = await db.all(getUserFollowingUserIdQuery);
    console.log(userFollowingIds);
    const idsArray = userFollowingIds.map((eachUser) => {
      return eachUser.following_user_id;
    });
    console.log(idsArray);
    const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${idsArray});`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);
    const tweetIdsArray = getTweetIdsArray.map((eachTweet) => {
      return eachTweet.tweet_id;
    });
    console.log(tweetIdsArray);
    if (tweetIdsArray.includes(parseInt(tweetId))) {
      const getLikedUsersNameQuery = `select user.username as likes from user inner join like
            on user.user_id=like.user_id where like.tweet_id=${tweetId};`;
      const getLikedUserNamesArray = await db.all(getLikedUsersNameQuery);
      const getLikedUserNames = getLikedUserNamesArray.map((eachUser) => {
        return eachUser.likes;
      });
      console.log(getLikedUserNames);
      response.send(
        convertLikedUserNameDBObjectToResponseObject(getLikedUserNames)
      );
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// GET ### returns who liked the tweet API 8
const convertUserNameReplyedDBObjectToResponseObject = (dbObject) => {
  return {
    replies: dbObject,
  };
};
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    //tweet id of which we need to get reply's
    const { tweetId } = request.params;
    console.log(tweetId);
    //user id from user name
    let { username } = request;
    const getUserIdQuery = `select user_id from user where username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);
    // console.log(getUserId);
    //get the ids of whom the user is following
    const getFollowingIdsQuery = `select following_user_id from follower where follower_user_id=${getUserId.user_id};`;
    const getFollowingIdsArray = await db.all(getFollowingIdsQuery);
    //console.log(getFollowingIdsArray);
    const getFollowingIds = getFollowingIdsArray.map((eachFollower) => {
      return eachFollower.following_user_id;
    });
    console.log(getFollowingIds);
    //check if the tweet ( using tweet id) made by the person he is  following
    const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${getFollowingIds});`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);
    const getTweetIds = getTweetIdsArray.map((eachTweet) => {
      return eachTweet.tweet_id;
    });
    console.log(getTweetIds);
    //console.log(getTweetIds.includes(parseInt(tweetId)));
    if (getTweetIds.includes(parseInt(tweetId))) {
      const getUsernameReplyTweetsQuery = `select user.name, reply.reply from user inner join reply on user.user_id=reply.user_id
      where reply.tweet_id=${tweetId};`;
      const getUsernameReplyTweets = await db.all(getUsernameReplyTweetsQuery);
      response.send(
        convertUserNameReplyedDBObjectToResponseObject(getUsernameReplyTweets)
      );
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//api9
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  console.log(getUserId);
  //get tweets made by user
  const getTweetIdsQuery = `select tweet_id from tweet where user_id=${getUserId.user_id};`;
  const getTweetIdsArray = await db.all(getTweetIdsQuery);
  const getTweetIds = getTweetIdsArray.map((eachId) => {
    return eachId.tweet_id;
  });
  console.log(getTweetIds);

  const getCountsQuery = `select  tweet,  count(distinct like_id) as likes,  count(distinct reply_id) as replies, tweet.date_time as dateTime from (tweet left join like
        on tweet.tweet_id=like.tweet_id) as T left join reply on reply.tweet_id = T.tweet_id where T.tweet_id in (${getTweetIds})
        group by T.tweet_id;`;
  const getTweetAndCountsArray = await db.all(getCountsQuery);

  console.log(getTweetAndCountsArray);
  response.send(getTweetAndCountsArray);
});

// API 10

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  //console.log(getUserId.user_id);
  const { tweet } = request.body;
  //console.log(tweet);

  const currentDate = new Date();
  console.log(currentDate.toISOString().replace("T", " "));

  const postRequestQuery = `insert into tweet(tweet, user_id, date_time) values ("${tweet}", ${getUserId.user_id}, '${currentDate}');`;

  const responseResult = await db.run(postRequestQuery);
  const tweet_id = responseResult.lastID;
  response.send("Created a Tweet");
});

//api 11
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    //console.log(tweetId);
    let { username } = request;
    const getUserIdQuery = `select user_id from user where username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);
    //console.log(getUserId.user_id);
    //tweets made by the user
    const getUserTweetsListQuery = `select tweet_id from tweet where user_id=${getUserId.user_id};`;
    const getUserTweetsListArray = await db.all(getUserTweetsListQuery);
    const getUserTweetsList = getUserTweetsListArray.map((eachTweetId) => {
      return eachTweetId.tweet_id;
    });
    console.log(getUserTweetsList);
    if (getUserTweetsList.includes(parseInt(tweetId))) {
      const deleteTweetQuery = `delete from tweet where tweet_id=${tweetId};`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
