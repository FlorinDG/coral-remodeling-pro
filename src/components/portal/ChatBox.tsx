"use client";

import { useState, useRef, useEffect } from 'react';
import { Send, User, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Message {
    id: string;
    content: string;
    sender: string; // 'ADMIN' or 'CLIENT'
    createdAt: string;
}

interface ChatBoxProps {
    portalId: string;
    initialMessages: Message[];
    currentUserType: 'ADMIN' | 'CLIENT';
}

export default function ChatBox({ portalId, initialMessages, currentUserType }: ChatBoxProps) {
    const t = useTranslations('Portal');
    const [messages, setMessages] = useState(initialMessages);
    const [newMessage, setNewMessage] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        // Optimistic UI
        const optimisticMsg = {
            id: Date.now().toString(),
            content: newMessage,
            sender: currentUserType,
            createdAt: new Date().toISOString()
        };
        setMessages([...messages, optimisticMsg]);
        setNewMessage('');

        await fetch('/api/portals/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portalId, content: newMessage, sender: currentUserType })
        });
    };

    return (
        <div className="glass-morphism rounded-3xl border border-neutral-200 dark:border-white/10 h-[500px] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5">
                <h3 className="font-bold flex items-center gap-2 text-neutral-900 dark:text-white">
                    {t('directMessage')}
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                {messages.length === 0 && <p className="text-center text-neutral-500 text-sm py-10">{t('noMessages')}</p>}
                {messages.map((msg) => {
                    const isMe = msg.sender === currentUserType;
                    return (
                        <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isMe ? 'bg-[#d35400]' : 'bg-neutral-200 dark:bg-neutral-700'}`}>
                                {msg.sender === 'ADMIN' ? <ShieldCheck className="w-4 h-4 text-white" /> : <User className={`w-4 h-4 ${isMe ? 'text-white' : 'text-neutral-600 dark:text-white'}`} />}
                            </div>
                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm dark:shadow-none ${isMe ? 'bg-[#d35400]/10 dark:bg-[#d35400]/20 border border-[#d35400]/20 dark:border-[#d35400]/30 text-neutral-900 dark:text-white rounded-tr-sm' : 'bg-neutral-100 dark:bg-white/10 border border-neutral-200 dark:border-white/5 text-neutral-700 dark:text-neutral-200 rounded-tl-sm'}`}>
                                {msg.content}
                            </div>
                        </div>
                    );
                })}
            </div>

            <form onSubmit={handleSend} className="p-4 bg-neutral-50 dark:bg-white/5 border-t border-neutral-200 dark:border-white/10 flex gap-2">
                <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={t('typeMessage')}
                    className="flex-1 bg-white/80 dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm focus:border-[#d35400] outline-none transition-colors text-neutral-900 dark:text-white placeholder-neutral-500"
                />
                <button type="submit" className="p-2 bg-[#d35400] hover:bg-[#a04000] rounded-xl transition-colors shadow-lg shadow-[#d35400]/20">
                    <Send className="w-4 h-4 text-white" />
                </button>
            </form>
        </div>
    );
}
