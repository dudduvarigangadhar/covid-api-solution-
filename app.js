const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
let db = null;
const initalizeDBAndServer = async () => {
  try {
    db = await open({
      filename: path.join(__dirname, "covid19IndiaPortal.db"),
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error '{e.message}'`);
    process.exit(1);
  }
};

initalizeDBAndServer();

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const getUser = `SELECT * FROM user WHERE username = '${username}';`;
  const dbResponse = await db.get(getUser);
  if (dbResponse === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      dbResponse.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "SCRET_CODE");
      console.log(jwtToken);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SCRET_CODE", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const dbResponseToObject = (state) => {
  return {
    stateId: state.state_id,
    stateName: state.state_name,
    population: state.population,
  };
};
app.get("/states/", authenticateToken, async (request, response) => {
  const { stateId, stateName, population } = request.body;
  const getUser = `SELECT * FROM state ORDER BY state_id;`;
  const dbResponse = await db.all(getUser);
  response.send(dbResponse.map((state) => dbResponseToObject(state)));
});

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getState = `SELECT * FROM state WHERE state_id = '${stateId}';`;
  const dbResponse = await db.get(getState);
  response.send({
    stateId: dbResponse.state_id,
    stateName: dbResponse.state_name,
    population: dbResponse.population,
  });
});

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrict = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths)
  VALUES(
      '${districtName}',
      '${stateId}',
      '${cases}',
      '${cured}',
      '${active}',
      '${deaths}'
  );`;
  const dbResponse = await db.run(addDistrict);
  const Id = dbResponse.lastID;
  console.log(Id);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrict = `SELECT * FROM district WHERE district_id = '${districtId}';`;
    const dbResponse = await db.get(getDistrict);
    response.send({
      districtId: dbResponse.district_id,
      districtName: dbResponse.district_name,
      stateId: dbResponse.state_id,
      cases: dbResponse.cases,
      cured: dbResponse.cured,
      active: dbResponse.active,
      deaths: dbResponse.deaths,
    });
  }
);
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrict = `DELETE FROM district WHERE district_id = '${districtId}';`;
    const dbResponse = await db.run(deleteDistrict);
    response.send("District Removed");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStats = `SELECT SUM(cases) AS totalCases,
  SUM(cured) AS totalCured,
  SUM(active) AS totalActive,
  SUM(deaths) AS totalDeaths
  FROM district WHERE state_id = '${stateId}';`;
    const dbResponse = await db.get(getStateStats);
    response.send(dbResponse);
  }
);

module.exports = app;
