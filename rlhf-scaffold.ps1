# =============================================================
# rlhf monorepo scaffold script
# Usage:  .\rlhf-scaffold.ps1
# Creates the full rlhf monorepo (Turborepo + pnpm workspaces)
# =============================================================

$ErrorActionPreference = "Stop"
$root = Get-Location

Write-Host "==> Scaffolding 'rlhf' monorepo at $root" -ForegroundColor Cyan

# -------------------------------------------------------------
# 1) Create all directories first
# -------------------------------------------------------------
Write-Host "==> [1/6] Creating directory structure..." -ForegroundColor Yellow

$dirs = @(
    "apps/web/src/app",
    "apps/web/src/lib",
    "apps/api/src",
    "packages/db/src/schema",
    "packages/shared/src/types",
    "packages/ui/src/components"
)
foreach ($d in $dirs) {
    $path = Join-Path $root $d
    New-Item -ItemType Directory -Force -Path $path | Out-Null
    Write-Host "    created  $d"
}

# Helper to write files from here-strings
function Write-ProjectFile {
    param([string]$RelativePath, [string]$Content)
    $full = Join-Path $root $RelativePath
    $Content | Out-File -FilePath $full -Encoding utf8 -NoNewline
    Write-Host "    written  $RelativePath"
}

# -------------------------------------------------------------
# 2) ROOT LEVEL FILES
# -------------------------------------------------------------
Write-Host "==> [2/6] Writing root files..." -ForegroundColor Yellow

Write-ProjectFile "package.json" @'
{
  "name": "rlhf",
  "private": true,
  "packageManager": "pnpm@10.11.0",
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "db:generate": "turbo run db:generate --filter=@rlhf/db",
    "db:push": "turbo run db:push --filter=@rlhf/db"
  },
  "devDependencies": {
    "turbo": "^2.5.0",
    "typescript": "^5.8.3"
  }
}
'@

Write-ProjectFile "pnpm-workspace.yaml" @'
packages:
  - "apps/*"
  - "packages/*"
'@

Write-ProjectFile "turbo.json" @'
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "db:generate": {
      "cache": false
    },
    "db:push": {
      "cache": false
    }
  }
}
'@

Write-ProjectFile ".gitignore" @'
node_modules/
.next/
dist/
.turbo/
coverage/
*.log
.env.local
.env.*.local
.DS_Store
'@

Write-ProjectFile ".env" @'
DATABASE_URL=postgresql://rlhf:rlhf_pass@localhost:5432/rlhf_lab
AUTH_SECRET=your-secret-here)
'@

Write-ProjectFile "tsconfig.base.json" @'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "incremental": true
  }
}
'@

Write-ProjectFile "docker-compose.yml" @'
services:
  postgres:
    image: postgres:16-alpine
    container_name: rlhf-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: rlhf
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: rlhf-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
'@

# -------------------------------------------------------------
# 3) apps/web  (Next.js)
# -------------------------------------------------------------
Write-Host "==> [3/6] Writing apps/web (Next.js)..." -ForegroundColor Yellow

Write-ProjectFile "apps/web/package.json" @'
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "16.3.0",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "next-auth": "^5.0.0-beta.25",
    "@rlhf/db": "workspace:*",
    "@rlhf/shared": "workspace:*",
    "@rlhf/ui": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.15.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "typescript": "^5.8.3",
    "tailwindcss": "^3.4.17",
    "postcss": "^8.5.3",
    "autoprefixer": "^10.4.21"
  }
}
'@

Write-ProjectFile "apps/web/tsconfig.json" @'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "jsx": "preserve",
    "allowJs": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
'@

Write-ProjectFile "apps/web/next.config.ts" @'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@rlhf/db", "@rlhf/shared", "@rlhf/ui"],
};

export default nextConfig;
'@

Write-ProjectFile "apps/web/tailwind.config.ts" @'
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
'@

Write-ProjectFile "apps/web/postcss.config.mjs" @'
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
'@

Write-ProjectFile "apps/web/src/app/layout.tsx" @'
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RLHF",
  description: "RLHF monorepo web application",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
'@

Write-ProjectFile "apps/web/src/app/page.tsx" @'
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">RLHF</h1>
      <p className="text-neutral-500">Next.js app is running.</p>
    </main>
  );
}
'@

Write-ProjectFile "apps/web/src/app/globals.css" @'
@tailwind base;
@tailwind components;
@tailwind utilities;
'@

Write-ProjectFile "apps/web/src/middleware.ts" @'
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/api/auth/signin", req.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
'@

Write-ProjectFile "apps/web/src/lib/auth.ts" @'
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        // TODO: validate against your database (packages/db users table)
        return {
          id: "1",
          email: credentials.email as string,
          name: "RLHF User",
        };
      },
    }),
  ],
});
'@

# -------------------------------------------------------------
# 4) apps/api  (NestJS)
# -------------------------------------------------------------
Write-Host "==> [4/6] Writing apps/api (NestJS)..." -ForegroundColor Yellow

Write-ProjectFile "apps/api/package.json" @'
{
  "name": "api",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main"
  },
  "dependencies": {
    "@nestjs/common": "10.4.15",
    "@nestjs/core": "10.4.15",
    "@nestjs/platform-express": "10.4.15",
    "@nestjs/config": "^3.3.0",
    "@rlhf/db": "workspace:*",
    "@rlhf/shared": "workspace:*",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.9",
    "@types/express": "^5.0.1",
    "@types/node": "^22.15.0",
    "typescript": "^5.8.3"
  }
}
'@

Write-ProjectFile "apps/api/tsconfig.json" @'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "target": "ES2021",
    "outDir": "./dist",
    "baseUrl": "./",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
'@

Write-ProjectFile "apps/api/tsconfig.build.json" @'
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
'@

Write-ProjectFile "apps/api/nest-cli.json" @'
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
'@

Write-ProjectFile "apps/api/src/main.ts" @'
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
'@

Write-ProjectFile "apps/api/src/app.module.ts" @'
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
'@

Write-ProjectFile "apps/api/src/app.controller.ts" @'
import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
'@

Write-ProjectFile "apps/api/src/app.service.ts" @'
import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getHello(): string {
    return "RLHF API is running!";
  }
}
'@

# -------------------------------------------------------------
# 5) packages  (db / shared / ui)
# -------------------------------------------------------------
Write-Host "==> [5/6] Writing packages (db, shared, ui)..." -ForegroundColor Yellow

# --- packages/db ---
Write-ProjectFile "packages/db/package.json" @'
{
  "name": "@rlhf/db",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "build": "tsc"
  },
  "dependencies": {
    "drizzle-orm": "0.43.1",
    "postgres": "^3.4.5"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.1",
    "typescript": "^5.8.3"
  }
}
'@

Write-ProjectFile "packages/db/tsconfig.json" @'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
'@

Write-ProjectFile "packages/db/drizzle.config.ts" @'
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
'@

Write-ProjectFile "packages/db/src/index.ts" @'
export * from "./client";
export * from "./schema";
'@

Write-ProjectFile "packages/db/src/client.ts" @'
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
export { schema };
'@

Write-ProjectFile "packages/db/src/schema/index.ts" @'
export * from "./users";
export * from "./sessions";
'@

Write-ProjectFile "packages/db/src/schema/users.ts" @'
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg.core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
'@

Write-ProjectFile "packages/db/src/schema/sessions.ts" @'
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg.core";
import { users } from "./users";

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sessionToken: text("session_token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
'@

# --- packages/shared ---
Write-ProjectFile "packages/shared/package.json" @'
{
  "name": "@rlhf/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc"
  },
  "devDependencies": {
    "typescript": "^5.8.3"
  }
}
'@

Write-ProjectFile "packages/shared/tsconfig.json" @'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
'@

Write-ProjectFile "packages/shared/src/index.ts" @'
export * from "./types";
'@

Write-ProjectFile "packages/shared/src/types/index.ts" @'
export interface User {
  id: string;
  email: string;
  name?: string | null;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  sessionToken: string;
  expiresAt: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
'@

# --- packages/ui ---
Write-ProjectFile "packages/ui/package.json" @'
{
  "name": "@rlhf/ui",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "react": "19.1.0",
    "react-dom": "19.1.0"
  },
  "devDependencies": {
    "@types/react": "^19.1.0",
    "typescript": "^5.8.3"
  }
}
'@

Write-ProjectFile "packages/ui/tsconfig.json" @'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
'@

Write-ProjectFile "packages/ui/src/index.ts" @'
export * from "./components/button";
'@

Write-ProjectFile "packages/ui/src/components/button.tsx" @'
"use client";

import * as React from "react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", ...props }, ref) => {
    const base =
      "px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50";
    const styles =
      variant === "primary"
        ? "bg-neutral-900 text-white hover:bg-neutral-700"
        : "bg-neutral-100 text-neutral-900 hover:bg-neutral-200";
    return (
      <button
        ref={ref}
        className={`${base} ${styles} ${className}`}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
'@

# -------------------------------------------------------------
# 6) Done
# -------------------------------------------------------------
Write-Host "==> [6/6] Scaffold complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. pnpm install"
Write-Host "  2. docker compose up -d        # start postgres + redis"
Write-Host "  3. pnpm db:push               # push Drizzle schema"
Write-Host "  4. pnpm dev                   # run apps in dev mode"
