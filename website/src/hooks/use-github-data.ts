"use client";

import { useState, useEffect } from "react";
import { GITHUB_API_URL } from "@/lib/constants";

interface GitHubData {
  stars: number;
  forks: number;
  openIssues: number;
  loading: boolean;
  error: string | null;
}

export function useGitHubData(): GitHubData {
  const [data, setData] = useState<GitHubData>({
    stars: 0,
    forks: 0,
    openIssues: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(GITHUB_API_URL);
        if (!response.ok) {
          throw new Error(`GitHub API returned ${response.status}`);
        }
        const json = await response.json();
        setData({
          stars: json.stargazers_count || 0,
          forks: json.forks_count || 0,
          openIssues: json.open_issues_count || 0,
          loading: false,
          error: null,
        });
      } catch (err) {
        setData((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to fetch",
        }));
      }
    };

    fetchData();
  }, []);

  return data;
}
