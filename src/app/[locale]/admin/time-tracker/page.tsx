"use client";
import { useEffect, useState } from "react";
import Index from "@/components/time-tracker/pages/Index";

export default function Page() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    return <Index />;
}
