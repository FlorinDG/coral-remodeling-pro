import { useState, useRef, useEffect } from 'react';
import { Send, User, ShieldCheck, Paperclip, Reply, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Message {
    id: string;
    content: string;
    sender: string; // 'ADMIN' or 'CLIENT'
    createdAt: string;
    fileUrl?: string | null;
    replyToId?: string | null;
    replyTo?: Message | null;
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
    const [fileUrl, setFileUrl] = useState('');
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() && !fileUrl.trim()) return;

        const res = await fetch('/api/portals/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                portalId,
                content: newMessage,
                sender: currentUserType,
                fileUrl: fileUrl || null,
                replyToId: replyTo?.id || null
            })
        });
        const savedMsg = await res.json();
        setMessages([...messages, { ...savedMsg, replyTo }]);
        setNewMessage('');
        setFileUrl('');
        setReplyTo(null);
    };

    return (
        <div className="bg-neutral-50 dark:bg-white/5 rounded-[2.5rem] border border-neutral-200 dark:border-white/10 h-[550px] flex flex-col overflow-hidden shadow-sm">
            <div className="p-6 border-b border-neutral-200 dark:border-white/10 bg-white/50 dark:bg-black/20 flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2 text-neutral-900 dark:text-white">
                    {t('directMessage')}
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar" ref={scrollRef}>
                {messages.length === 0 && <p className="text-center text-neutral-500 text-sm py-10 italic">{t('noMessages')}</p>}
                {messages.map((msg) => {
                    const isMe = msg.sender === currentUserType;
                    const replyTarget = msg.replyToId ? messages.find(m => m.id === msg.replyToId) : null;

                    return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                            {replyTarget && (
                                <div className={`flex items-center gap-2 text-[10px] text-neutral-400 mb-1 px-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                                    <Reply className="w-3 h-3 rotate-180" />
                                    <span className="truncate max-w-[150px]">Replying to: {replyTarget.content}</span>
                                </div>
                            )}
                            <div className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg ${isMe ? 'bg-[#d35400] shadow-[#d35400]/20' : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'}`}>
                                    {msg.sender === 'ADMIN' ? <ShieldCheck className="w-4 h-4 text-white" /> : <User className={`w-4 h-4 ${isMe ? 'text-white' : 'text-neutral-600 dark:text-white'}`} />}
                                </div>
                                <div className="space-y-1">
                                    <div className={`p-4 rounded-2xl text-sm leading-relaxed ${isMe ? 'bg-[#d35400] text-white rounded-tr-sm shadow-xl shadow-[#d35400]/10' : 'bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 text-neutral-800 dark:text-neutral-200 rounded-tl-sm shadow-sm'}`}>
                                        {msg.content}
                                        {msg.fileUrl && (
                                            <a href={msg.fileUrl} target="_blank" className={`mt-2 flex items-center gap-2 p-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors ${isMe ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-[#d35400]/10 hover:bg-[#d35400]/20 text-[#d35400]'}`}>
                                                <Paperclip className="w-3 h-3" /> Attachment
                                            </a>
                                        )}
                                    </div>
                                    <div className={`flex items-center gap-4 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                                        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        <button
                                            onClick={() => setReplyTo(msg)}
                                            className="text-[9px] font-black text-[#d35400] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            Reply
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="bg-white/50 dark:bg-black/20 border-t border-neutral-200 dark:border-white/10 p-4 space-y-3">
                {replyTo && (
                    <div className="bg-[#d35400]/10 p-3 rounded-2xl flex items-center justify-between animate-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-2 text-xs">
                            <Reply className="w-3 h-3 text-[#d35400]" />
                            <span className="text-neutral-500 font-medium">Replying to: </span>
                            <span className="text-neutral-900 dark:text-white font-bold truncate max-w-[200px]">{replyTo.content}</span>
                        </div>
                        <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-neutral-200 dark:hover:bg-white/10 rounded-full transition-colors">
                            <X className="w-3 h-3 text-neutral-500" />
                        </button>
                    </div>
                )}

                <form onSubmit={handleSend} className="flex gap-3">
                    <div className="flex-1 relative">
                        <input
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={t('typeMessage')}
                            className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-[1.5rem] px-6 py-4 text-sm focus:border-[#d35400] outline-none transition-colors text-neutral-900 dark:text-white shadow-inner"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const url = prompt('Enter file link:');
                                if (url) setFileUrl(url);
                            }}
                            className={`absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${fileUrl ? 'bg-[#d35400] text-white' : 'text-neutral-400 hover:text-[#d35400]'}`}
                        >
                            <Paperclip className="w-4 h-4" />
                        </button>
                    </div>
                    <button type="submit" className="p-4 bg-[#d35400] hover:bg-neutral-900 text-white rounded-[1.5rem] transition-all shadow-xl shadow-[#d35400]/20 flex items-center justify-center min-w-[56px] group">
                        <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </button>
                </form>
                {fileUrl && (
                    <div className="flex items-center gap-2 px-6">
                        <span className="text-[10px] font-bold text-[#d35400] uppercase tracking-widest flex items-center gap-1">
                            <Paperclip className="w-3 h-3" /> Attached: {fileUrl.substring(0, 30)}...
                        </span>
                        <button onClick={() => setFileUrl('')} className="text-[10px] font-bold text-neutral-500 hover:text-red-500 uppercase tracking-widest">Remove</button>
                    </div>
                )}
            </div>
        </div>
    );
}
