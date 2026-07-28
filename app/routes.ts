import { prefix, route, type RouteConfig } from "@react-router/dev/routes";

export default [
    route("/", "routes/_index.tsx"),


    route("/app", "routes/app/layout.tsx", [
        route("", "routes/app/home.tsx"),
        ...prefix("lists", [
            route("mylists", "routes/app/lists/mylists.tsx"),
            route("edit/:listId", "routes/app/lists/new.tsx"),
            route(":listId", "routes/app/lists/view.tsx")
        ])
    ]),

    ...prefix("auth", [
        route("login", "routes/auth/login.tsx"),
    ]),
] satisfies RouteConfig;
