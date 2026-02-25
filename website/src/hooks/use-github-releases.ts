"use client";

import { useState, useEffect } from "react";
import { GITHUB_API_URL } from "@/lib/constants";

interface Release {
  tag_name: string;
  name: string;
  html_url: string;
  zipball_url: string;
  tarball_url: string;
  published_at: string;
}

interface GitHubReleases {
  latest: Release | null;
  releases: Release[];
  loading: boolean;
  error: string | null;
}

export function useGitHubReleases(): GitHubReleases {
  const [data, setData] = useState<GitHubReleases>({
    latest: null,
    releases: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    const fetchReleases = async () => {
      try {
        const response = await fetch(`${GITHUB_API_URL}/releases`);
        if (!response.ok) {
          throw new Error(`GitHub API returned ${response.status}`);
        }
        const json: Release[] = await response.json();
        setData({
          latest: json.length > 0 ? json[0] : null,
          releases: json.slice(0, 5),
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

    fetchReleases();
  }, []);

  return data;
}
