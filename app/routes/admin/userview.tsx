// TODO: dit maken!!
import { redirect } from "react-router";
import type { Route } from "./+types/userview";

export async function loader(loaderArgs: Route.LoaderArgs) {
    const postId = loaderArgs.params.userId;


}

export default function Home({ }: Route.ComponentProps) {

}
