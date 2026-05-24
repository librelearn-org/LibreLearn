import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Button } from "~/components/button/button";
import { subjects } from "~/components/Icons";
import { authClient } from "~/utils/auth/client";
import { useTRPC } from "~/utils/trpc/react";


export default function Component() {
    const trpc = useTRPC();
    const navigate = useNavigate();

    const nukeForum = useMutation(trpc.forum.nukeForum.mutationOptions());
    const nukeNotYetUsedDBTables = useMutation(trpc.admin.nukeNotYetUsedDBTables.mutationOptions());

    const makeTestPostMutation = useMutation(trpc.forum.makePost.mutationOptions())
    function makeTestPosts(){
        makeTestPostMutation.mutate({
            title: crypto.randomUUID() as string,
            subject: `${subjects.at(Math.floor(Math.random() * subjects.length))?.slug ?? ""}` as string,
            content: "test"
        })
    }
    function makeTestPoststen(){
        for (let i = 0; i < 10; i++){
            makeTestPosts()
        }
    }
    return (
        <div className="flex flex-col items-center gap-4">
            <h1 className="font-bold " >Testing helper.</h1>
            <Button onClick={() => {
                authClient.signOut().then(() => {
                    navigate("/")
                })
            }}>
                logout session
            </Button>

            <Button onClick={() => nukeForum.mutate()}>
                NUKE FORUM!!!
            </Button>
            <Button onClick={() => nukeNotYetUsedDBTables.mutate()}>
                Nuke unused DB tables (should be safe)
            </Button>
            <Button onClick={makeTestPosts}>
                Make test post (not in prod plz)
            </Button>
            <Button onClick={makeTestPoststen}>
                Make test post 10x (not in prod plz)
            </Button>
        </div>
    );
}