const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const bcrypt = require("bcrypt");
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

//API 1 REGISTER USER
app.post("/register/", async (request, response) => {
  const userDetails = request.body;
  const { username, password, name, gender } = userDetails;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const registerUserQuery = `
            INSERT INTO user (name,username,password,gender)
            VALUES ('${name}','${username}','${hashedPassword}','${gender}');
        `;
      await db.run(registerUserQuery);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//API 2 LOGIN USER
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      const payload = { username: username, userId: dbUser.user_id };
      const jwtToken = jwt.sign(payload, "MY_SECRET_CODE");
      response.send({ jwtToken });
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//middleware for authentication
const authenticate = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Access Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_CODE", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid Access Token");
      } else {
        request.username = payload.username;
        request.userId = payload.userId;
        next();
      }
    });
  }
};

//GETTING FOLLOWING USER IDS
const getFollowingPeopleIdsOfUser = async (username) => {
  const getTheFollowingPeopleQuery = `
  SELECT
following_user_id FROM follower
INNER JOIN user ON user.user_id = follower.follower_user_id
WHERE user.username='${username}';`;

  const followingPeople = await db.all(getTheFollowingPeopleQuery);
  return followingPeople.map((eachUser) => eachUser.following_user_id);
};
const followingUser = async (request, response, next) => {
  const { username, userId } = request;
  const { tweetId } = request.params;
  const getFollowingQuery = `
    SELECT * FROM tweet INNER JOIN follower
    ON tweet.user_id = follower.following_user_id
    WHERE tweet.tweet_id = '${tweetId}' AND follower_user_id = '${userId}';
    `;
  const isFollowing = await db.get(getFollowingQuery);
  if (isFollowing === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    next();
  }
};
//API 3 latest tweets
app.get("/user/tweets/feed/", authenticate, async (request, response) => {
  const { username } = request;
  const FollowingIds = await getFollowingPeopleIdsOfUser(username);

  const getTweetsQuery = `SELECT
    username,tweet, date_time as dateTime
    FROM user INNER JOIN tweet ON user.user_id = tweet.user_id
    WHERE 
    user.user_id IN (${FollowingIds})
    ORDER BY date_time DESC
    LIMIT 4;
    `;
  const latestTweets = await db.all(getTweetsQuery);
  response.send(latestTweets);
});

//API 4 following users names
app.get("/user/following/", authenticate, async (request, response) => {
  const { username, userId } = request;
  const getFollowingsQuery = `
    SELECT name FROM follower JOIN user ON follower.following_user_id= user.user_id
    WHERE follower_user_id=${userId};`;
  const followings = await db.all(getFollowingsQuery);
  response.send(followings);
});

//API 5 FOLLOWERS NAMES
app.get("/user/followers/", authenticate, async (request, response) => {
  const { username, userId } = request;
  const getFollowersQuery = `
    SELECT name FROM follower JOIN user ON follower.following_user_id= user.user_id
    WHERE following_user_id=${userId};`;
  const followers = await db.all(getFollowersQuery);
  response.send(followers);
});

//API 6
app.get(
  "/tweets/:tweetId/",
  authenticate,
  followingUser,
  async (request, response) => {
    const { tweetId } = request.params;
    const getTweetQuery = `
    SELECT tweet,
    (SELECT COUNT() FROM like WHERE tweet_id = '${tweetId}') AS likes,
    (SELECT COUNT() FROM reply WHERE tweet_id = '${tweetId}') AS replies,
    date_time AS dateTime
    FROM tweet
    WHERE tweet.tweet_id = '${tweetId}' ;`;
    const tweet = await db.get(getTweetQuery);
    response.send(tweet);
  }
);

//API 7 liked user names
app.get(
  "/tweets/:tweetId/likes/",
  authenticate,
  followingUser,
  async (request, response) => {
    const { tweetId } = request.params;
    const getLikedUsersQuery = `
    SELECT username FROM user JOIN like ON user.user_id = like.user_id
    WHERE tweet_id=${tweetId};`;
    const likedUsers = await db.all(getLikedUsersQuery);
    response.send({ likes: likedUsers.map((each) => each.username) });
  }
);

//API 8 REPLIES FOR A TWEET
app.get(
  "/tweets/:tweetId/replies/",
  authenticate,
  followingUser,
  async (request, response) => {
    const { tweetId } = request.params;
    const getRepliesQuery = `
    SELECT name,reply FROM user INNER JOIN reply ON user.user_id=reply.user_id
    WHERE tweet_id=${tweetId};
    `;
    const replies = await db.all(getRepliesQuery);
    response.send({ replies: replies });
  }
);

//API 9 all tweets of the user
app.get("/user/tweets/", authenticate, async (request, response) => {
  const { userId } = request;
  const getTweetsQuery = `
    SELECT tweet,
    COUNT(DISTINCT like_id) AS likes,
    COUNT(DISTINCT reply_id) AS replies,
    date_time AS dateTime
    FROM tweet LEFT JOIN reply ON tweet.tweet_id = reply.tweet_id
    LEFT JOIN like ON tweet.tweet_id = like.tweet_id
    WHERE tweet.user_id = ${userId}
    GROUP BY tweet.tweet_id;
    `;
  const tweets = await db.all(getTweetsQuery);
  response.send(tweets);
});

//API 10 CREATE TWEET
app.post("/user/tweets/", authenticate, async (request, response) => {
  const { userId } = request;
  const { tweet } = request.body;
  const dateTime = new Date().toJSON().substring(0, 19).replace("T", " ");
  const createTweetQuery = `
  INSERT INTO tweet(tweet,user_id,date_time)
  VALUES ('${tweet}','${userId}','${dateTime}');
  `;
  await db.run(createTweetQuery);
  response.send("Created a Tweet");
});

//API 11 delete tweet
app.delete("/tweets/:tweetId/", authenticate, async (request, response) => {
  const { tweetId } = request.params;
  const { userId } = request;
  const getTweetQuery = `SELECT * FROM tweet WHERE user_id=${userId} AND tweet_id=${tweetId}; `;
  const dbTweet = await db.get(getTweetQuery);
  if (dbTweet === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id=${tweetId};`;
    await db.run(deleteTweetQuery);
    response.send("Tweet Removed");
  }
});
module.exports = app;
