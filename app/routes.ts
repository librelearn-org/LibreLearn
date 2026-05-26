import { prefix, route, type RouteConfig } from "@react-router/dev/routes";

export default [
    route("/", "routes/_index.tsx"),

    route("/api/auth/*", "routes/api/auth.ts"),
    route("/api/trpc/*", "routes/api/trpc.ts"),

    route("/app", "routes/app/layout.tsx", [
        route("", "routes/app/home.tsx"),

        ...prefix("list", [
            route(":listId", "routes/app/lists/viewer.tsx"),
            route("new/:listId", "routes/app/lists/new.tsx"),
            route("beta", "routes/app/lists/betaUiLinker.tsx"),
        ]),
        route("learn/:listId/:mode", "routes/app/learn.tsx"),
    ]),

    ...prefix("auth", [
        route("login", "routes/auth/login.tsx"),
    ]),

    route("/admin", "routes/admin/layout.tsx", [
        route("", "routes/admin/index.tsx"),
        route("test", "routes/admin/testing.tsx"),
        route("users/:userId", "routes/admin/userview.tsx"),
        route("users", "routes/admin/users.tsx"),
    ]),
    route("/nee", "routes/admin/nee.tsx"),
] satisfies RouteConfig;
