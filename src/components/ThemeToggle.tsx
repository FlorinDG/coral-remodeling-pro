"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
    const [mounted, setMounted] = React.useState(false)
    const { theme, setTheme } = useTheme()

    React.useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return (
            <button className="relative w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/10 opacity-50">
                <span className="sr-only">Toggle theme</span>
            </button>
        )
    }

    const cycleTheme = () => {
        if (theme === "system") setTheme("light");
        else if (theme === "light") setTheme("dark");
        else setTheme("system");
    };

    return (
        <button
            onClick={cycleTheme}
            className="relative w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors border border-white/10"
            title={`Current theme: ${theme}`}
        >
            {theme === "light" && <Sun className="h-[1.2rem] w-[1.2rem] text-orange-500" />}
            {theme === "dark" && <Moon className="h-[1.2rem] w-[1.2rem] text-white" />}
            {theme === "system" && <Monitor className="h-[1.2rem] w-[1.2rem] text-neutral-400" />}
            <span className="sr-only">Toggle theme</span>
        </button>
    )
}
