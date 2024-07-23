import React, { useEffect, useState } from "react";
import Axios from "axios";

const ShowTodos = () => {
  const [todos, setTodos] = useState([]);

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      const response = await Axios.get("http://localhost:3000/get/items", {
        withCredentials: true
      });
      setTodos(response.data);
    } catch (err) {
      console.error("Error fetching todos", err);
    }
  };

  return (
    <div>
      {todos.map((todo) => (
        <div key={todo.ID}>
          <p>{todo.Task}</p>
          <p>{todo.Current_date}</p>
          <p>{todo.Due_date}</p>
        </div>
      ))}
    </div>
  );
};

export default ShowTodos;
