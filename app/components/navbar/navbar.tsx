import { Button } from "../button/button";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import logo from "~/../public/logo_outline.svg";
import "./navbar.css";

type knop = {
    title: string,
    linkTo: string
}

type NavbarProps = {
    knoppen?: knop[]
}

export const Navbar = ({ knoppen }: NavbarProps = {}) => {
    const buttons = knoppen ?? [
        { title: "Home", linkTo: "/app" },
        { title: "Lists", linkTo: "/app/list/beta" },
    ]

    const navigate = useNavigate()
    return <nav>
        {/* oh ja ik vind animations leuk. */}
        <motion.div
            className="flex flex-row justify-left items-center gap-3"
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
        >
            <div className={'navbar'}>
                <img src={logo} alt="Logo" className="logo" onClick={() => navigate('/app')} />
                {buttons.map((knop) => (
                    <Button key={`${knop.linkTo}-${knop.title}`} variant='secondary' onClick={() => { navigate(knop.linkTo) }}>{knop.title}</Button>
                ))}
            </div>
        </motion.div>
    </nav>;
}
