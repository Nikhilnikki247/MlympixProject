const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "project.db");

const app = express();

app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const responseObjToDbObj = (dbObject) => {
  return {
    name: dbObject.name,
    age: dbObject.age,
    location: dbObject.location,
    email: dbObject.email,
    phoneNumber: dbObject.phone_number,
  };
};

const dbScoresToResponse = (dbObject) => {
  return {
    matchId: dbObject.match_id,
    playerId: dbObject.player_id,
    scores: dbObject.scores,
  };
};

const totalResultResponseToDb=(dbObject)=>{
    return {
        playerId:dbObject.player_id,
        name:dbObject.name,
        matches:dbObject.Matches,
        highestScores:dbObject.HighestScores,
        totalScores:dbObject.TotalScores,
        wins:dbObject.Wins
    }
}
function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "nikki123", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM Players WHERE user_name = '${username}';`;
  const databaseUser = await database.get(selectUserQuery);

  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (password === databaseUser.password) {
      const payload = {
        user_name: username,
      };
      const jwtToken = jwt.sign(payload, "nikki123");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/playersList/",authenticateToken,async (request, response) => {
  const data = `
   SELECT
   *
   FROM
   Players
   WHERE 
   age=22;`;
  const result = await database.all(data);
  console.log(result);
  response.send(result.map((each) => responseObjToDbObj(each)));
});

app.post("/scores/",authenticateToken, async (request, response) => {
  const { matchId, playerId, name, scores, wins } = request.body;
  const query = `
    INSERT
      Scores(match_id,player_id,name,scores,wins)
    VALUES
      (${matchId},${playerId},${name},${scores},${wins});`;
  await database.run(query);
  response.send("Data Added Successfully");
});

app.post("/showScores/",authenticateToken, async (request, response) => {
  const { matchId, playerId } = request.body;
  const admin = `
    SELECT 
    *
    FROM
    Players NATURAL JOIN Scores
    WHERE 
    admin=1;`;
  const dbPlayer = await database.get(admin);
  if (dbPlayer.player_id === playerId) {
    const query = `
        SELECT 
         match_id,player_id,scores
        FROM 
        Scores
        WHERE
        match_id=${matchId}
        ORDER BY 
        scores DESC;`;
    const dbObj = await database.get(query);
    response.send(dbObj.map((each) => dbScoresToResponse(each)));
  }
});

app.get("/winner/:matchId/",authenticateToken, async (request, response) => {
  const { matchId } = request.params;
  const query = `
    SELECT
    MAX(scores)
    FROM
     Scores
    WHERE
     matchId=${matchId}`;
  const data = await database.get(query);
  const updateWins = `
      UPDATE
       Scores
      SET
       wins=1
      WHERE
       player_id=${data.player_id} AND match_id=${matchId};
    `;
  await database.run(updateWins);
  response.send(`${data.name} is the match Winner`);
});

app.get("/game/statics/",authenticateToken,async (request,response)=>{
    const totalResults=`
    SELECT 
    distinct(player_id),name,COUNT(match_id) AS Matches,MAX(scores) AS HighestScore,SUM(score) AS TotalScore,SUM(wins) AS Wins
    FROM
     Scores
    ORDER BY
     Wins DESC ; 
    `;
    const resultsData=await.all(totalResults)
    response.send(resultsData.map(each=>totalResultResponseToDb(each)))
})
module.exports = app;
