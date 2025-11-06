import { NextResponse } from "next/server";
import { syncVentesDepuisSquare } from "@/lib/syncSquareToFirestore";

export async function GET() {
  try {
    await syncVentesDepuisSquare();
    return NextResponse.json({ status: "ok" });
  } catch (e) {
    console.error("Erreur de synchronisation :", e);
    return NextResponse.json({ status: "erreur" }, { status: 500 });
  }
}
