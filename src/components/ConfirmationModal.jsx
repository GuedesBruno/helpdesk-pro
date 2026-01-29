'use client';
import { AlertTriangle, HelpCircle, X } from 'lucide-react';

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'primary' // 'primary', 'danger', 'warning'
}) {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (variant) {
            case 'danger': return <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />;
            case 'warning': return <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />;
            default: return <HelpCircle className="w-12 h-12 text-tec-blue mb-4" />;
        }
    };

    const getButtonStyles = () => {
        switch (variant) {
            case 'danger': return 'bg-red-600 hover:bg-red-700 focus:ring-red-200';
            case 'warning': return 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-200';
            default: return 'bg-tec-blue hover:bg-tec-blue-light focus:ring-blue-200';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-in fade-in duration-200 backdrop-blur-sm">
            <div className="bg-white rounded-xl p-8 max-w-sm w-full shadow-2xl transform transition-all scale-100 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center text-center">
                    {getIcon()}
                    <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
                    <p className="text-slate-600 mb-8">{message}</p>

                    <div className="flex gap-3 w-full">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors focus:ring-4 focus:ring-gray-100 focus:outline-none"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`flex-1 px-4 py-2.5 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl focus:ring-4 focus:outline-none ${getButtonStyles()}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
