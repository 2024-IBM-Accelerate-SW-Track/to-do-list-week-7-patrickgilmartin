import React, { useState } from "react";
import { Button, TextField } from "@mui/material";
import Axios from "axios";

const SearchTodo = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const handleChange = (e) => {
    setQuery(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await Axios.get(`http://localhost:3000/get/searchitem`, {
        params: { taskname: query },
        withCredentials: true
      });
      setResults(response.data.filter(todo => !todo.completed)); // Show only active todos
    } catch (error) {
      console.error("Error searching items", error);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <TextField
          label="Search for ToDo Item"
          variant="outlined"
          onChange={handleChange}
          value={query}
        />
        <Button
          style={{ marginLeft: "10px", marginTop: 10 }}
          variant="contained"
          color="primary"
          type="submit"
        >
          Search
        </Button>
      </form>
      <div>
        {results.map((result) => (
          <div key={result.ID}>
            <h3>{result.Task}</h3>
            <p>{result.Current_date} - {result.Due_date}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchTodo;
