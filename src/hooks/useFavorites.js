import { useEffect, useState } from "react";
import { FAVORITES_STORAGE_KEY } from "../constants";
import { readStorage, writeStorage } from "../utils/storage";

export function useFavorites() {
  const [favorites, setFavorites] = useState(() => {
    const value = readStorage(FAVORITES_STORAGE_KEY, []);
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  });

  useEffect(() => {
    writeStorage(FAVORITES_STORAGE_KEY, favorites);
  }, [favorites]);

  return [favorites, setFavorites];
}
