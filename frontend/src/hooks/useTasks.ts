"use client";

import { useState, useEffect, useCallback } from "react";

type Task = { id: number; title: string; done: boolean };

export function useTasks(token: string | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/backend/tasks", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }
      
      const data = await response.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchTasks();
    } else {
      setTasks([]);
    }
  }, [token, fetchTasks]);

  const addTask = async (title: string) => {
    if (!token) return null;
    
    try {
      const response = await fetch("/api/backend/tasks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title })
      });
      
      if (!response.ok) {
        throw new Error("Failed to create task");
      }
      
      const newTask = await response.json();
      await fetchTasks();
      return newTask;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    }
  };

  const deleteTask = async (id: number) => {
    if (!token) return false;
    
    try {
      const response = await fetch(`/api/backend/tasks/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete task");
      }
      
      await fetchTasks();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return false;
    }
  };

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    addTask,
    deleteTask
  };
}
