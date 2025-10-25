import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../../../lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "change_this_in_production";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password, remember } = body as {
      email?: string;
      password?: string;
      remember?: boolean;
    };

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Select only the fields we need — keeps TS types narrow and predictable
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        passwordHash: true, // <-- ensure this field exists in your Prisma schema
      },
    });

    // If user not found or no passwordHash saved, reject
    if (!user || !user.passwordHash) {
      console.warn("[auth] user missing or no passwordHash:", normalizedEmail);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Compare password against passwordHash
    const isValid = await bcrypt.compare(String(password), user.passwordHash);
    if (!isValid) {
      console.warn("[auth] password mismatch for:", normalizedEmail);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Create JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: remember ? "30d" : "1d" }
    );

    // Prepare response and set cookie
    const res = NextResponse.json({
      message: "Login successful",
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token,
    });

    res.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24,
    });

    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
