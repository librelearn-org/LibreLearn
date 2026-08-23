import { useOutletContext } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/utils/trpc/react";

export default function AdminHome() {
    const user = useOutletContext<any>();
    const trpc = useTRPC();
    const { data: usersData, isLoading } = useQuery(trpc.admin.getAllUsers.queryOptions(undefined));

    return (
        <div className="padding">
            <h2>Admin Dashboard</h2>
            <p>Ga naar een pagina ofzo</p>
        </div>
    );
}

