import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Button } from "~/components/button/button";
import { subjects } from "~/components/Icons";
import { authClient } from "~/utils/auth/client";
import { useTRPC } from "~/utils/trpc/react";


export default function Component() {
    const trpc = useTRPC();
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center gap-4">
            <h1 className="font-bold " >Testing helper.</h1>
            <p>er was hier wat maar toen vw ik het f*rum</p>
        </div>
    );
}