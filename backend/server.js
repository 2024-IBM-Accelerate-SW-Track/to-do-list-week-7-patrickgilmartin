const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require('body-parser');
const fsPromises = require("fs").promises;
const moment = require("moment");
const basicAuth = require("express-basic-auth");
const cookieParser = require("cookie-parser");
const { CloudantV1 } = require('@ibm-cloud/cloudant');
const { authenticator, upsertUser, cookieAuth } = require("./authentication");

const todoDBName = "tododb";
const useCloudant = true;

if (useCloudant) {
    initDB();
}

app.use(cors({
    credentials: true,
    origin: 'http://localhost:3000'
}));
app.use(express.json());
app.use(bodyParser.json({ extended: true }));
app.use(cookieParser("82e4e438a0705fabf61f9854e3b575af"));

function startServer(port) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is busy, trying ${port + 1}`);
      startServer(port + 1);
    } else {
      console.error(err);
    }
  });
}

app.get("/", (req, res) => {
  res.send({ message: "Connected to Backend server!" });
});

// Add authentication endpoints
app.get("/authenticate", basicAuth({ authorizer: authenticator }), (req, res) => {
    console.log(`user logging in: ${req.auth.user}`);
    res.cookie('user', req.auth.user, { signed: true });
    res.sendStatus(200);
});

app.post("/users", (req, res) => {
    const b64auth = (req.headers.authorization || '').split(' ')[1] || ''
    const [username, password] = Buffer.from(b64auth, 'base64').toString().split(':')
    const upsertSucceeded = upsertUser(username, password)
    res.sendStatus(upsertSucceeded ? 200 : 401);
});

app.get("/logout", (req, res) => {
    res.clearCookie('user');
    res.end();
});

app.post("/add/item", cookieAuth, async (req, res) => {
    try {
        const { id, task, currentDate, dueDate, eventType } = req.body.jsonObject;

        if (!id || !task || !currentDate || !dueDate || !eventType) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const newTask = {
          ID: id,
          Task: task,
          Current_date: moment(currentDate).toISOString(),
          Due_date: moment(dueDate, ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]).format("MM/DD/YYYY"), // Ensure MM/DD/YYYY format
          Event_type: eventType,
          completed: false // Add completed field
        };

        if (!moment(newTask.Due_date, "MM/DD/YYYY", true).isValid()) {
            return res.status(400).json({ error: "Invalid date format" });
        }

        if (useCloudant) {
            const client = CloudantV1.newInstance({});
            const todoDocument = { _id: id.toString(), task, curDate: currentDate, dueDate };
            await client.postDocument({ db: todoDBName, document: todoDocument });
            console.log('Successfully wrote to cloudant DB');
        } else {
            const data = await fsPromises.readFile("database.json");
            const json = JSON.parse(data);
            json.push(newTask);
            await fsPromises.writeFile("database.json", JSON.stringify(json));
            console.log('Successfully wrote to file');
        }
        res.sendStatus(200);
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post("/add/items", cookieAuth, async (req, res) => {
  try {
    const { todos } = req.body;

    if (!Array.isArray(todos) || todos.length === 0) {
      return res.status(400).json({ error: "Invalid or empty todos array" });
    }

    const data = await fsPromises.readFile("database.json");
    let json = JSON.parse(data);

    const newTodos = todos.map(todo => {
      const parsedDueDate = moment(todo.dueDate, ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD", "M/D/YYYY", "D/M/YYYY"], true);

      if (!parsedDueDate.isValid()) {
        console.warn(`Invalid date for todo: ${todo.task}`);
        return null;
      }

      return {
        ID: todo.id,
        Task: todo.task,
        Current_date: todo.currentDate,
        Due_date: parsedDueDate.format("MM/DD/YYYY"),
        Event_type: todo.eventType,
        completed: false // Add completed field
      };
    }).filter(todo => todo !== null);

    json = json.concat(newTodos);
    await fsPromises.writeFile("database.json", JSON.stringify(json));

    res.status(200).json({ 
      message: "Todos added successfully", 
      addedCount: newTodos.length 
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/get/items", cookieAuth, async (req, res) => {
  try {
    if (useCloudant) {
        const client = CloudantV1.newInstance({});
        const listofdocs = (await client.postAllDocs({ db: todoDBName, includeDocs: true })).result;
        res.json(JSON.stringify(listofdocs));
    } else {
        const data = await fsPromises.readFile("database.json");
        res.json(JSON.parse(data));
    }
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/get/searchitem", cookieAuth, async (req, res) => {
  try {
    const searchField = req.query.taskname;
    if (useCloudant) {
        const client = CloudantV1.newInstance({});
        const search_results = (await client.postSearch({ db: todoDBName, ddoc: 'newdesign', query: 'task:' + searchField, index: 'newSearch' })).result;
        console.log(search_results);
        res.json(JSON.stringify(search_results));
    } else {
        const json = JSON.parse(await fsPromises.readFile("database.json"));
        const returnData = json.filter(jsondata => jsondata.Task === searchField);
        res.json(returnData);
    }
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/delete/item/:id", cookieAuth, async (req, res) => {
  try {
    const id = parseFloat(req.params.id);
    const data = await fsPromises.readFile("database.json");
    const json = JSON.parse(data);
    const newJson = json.filter((todo) => todo.ID !== id);
    await fsPromises.writeFile("database.json", JSON.stringify(newJson));
    res.sendStatus(200);
  } catch (err) {
    console.log("Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/complete/item/:id", cookieAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const data = await fsPromises.readFile("database.json");
    const todos = JSON.parse(data);
    const updatedTodos = todos.map(todo => {
      if (todo.ID.toString() === id) {  // Convert ID to string for comparison
        return { ...todo, completed: true };
      }
      return todo;
    });
    await fsPromises.writeFile("database.json", JSON.stringify(updatedTodos));
    res.sendStatus(200);
  } catch (err) {
    console.log("Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

async function initDB() {
    try {
        const client = CloudantV1.newInstance({});
        const putDatabaseResult = (await client.putDatabase({ db: todoDBName })).result;
        if (putDatabaseResult.ok) {
            console.log(`"${todoDBName}" database created.`);
        }
    } catch (err) {
        console.log(`Cannot create "${todoDBName}" database, err: "${err.message}".`);
    }
}

startServer(5000); // Start the server on port 5000
