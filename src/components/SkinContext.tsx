"use client";

import { createContext, useContext } from "react";
import { SKINS, type Skin } from "@/lib/skins";

export const SkinContext = createContext<Skin>(Object.values(SKINS)[0]);
export const useSkin = () => useContext(SkinContext);
