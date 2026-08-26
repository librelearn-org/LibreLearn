import { prefix, route, type RouteConfig } from "@react-router/dev/routes";

export default [
    route("/", "routes/_index.tsx"),


    route("/app", "routes/app/layout.tsx", [
        route("", "routes/app/home.tsx"),
        route("learn/:id", "routes/app/learn.tsx"),
        route("sessionstart/:listId", "routes/app/sessionstart.tsx"),
        ...prefix("lists", [
            route("mylists", "routes/app/lists/mylists.tsx"),
            route("edit/:listId", "routes/app/lists/new.tsx"),
            route(":listId", "routes/app/lists/view.tsx")
        ])
    ]),

    route("/admin", "routes/admin/layout.tsx", [
        route("", "routes/admin/home.tsx"),
        route("ulist", "routes/admin/gebruikerslijst.tsx")
    ]),

    ...prefix("auth", [
        route("login", "routes/auth/login.tsx"),
    ]),

    route("api/auth/*", "routes/api/auth.ts"),
] satisfies RouteConfig;
