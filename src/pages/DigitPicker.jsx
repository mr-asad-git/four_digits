import React, { useState } from 'react'

/**
 * DigitPicker — Modal where a player selects N digits (4–8).
 * Props:
 *   digitCount  — how many digits to pick (default 4)
 *   onConfirm   — called with digits array
 *   onCancel    — called on cancel
 */
const DigitPicker = ({ onConfirm, onCancel, digitCount = 4 }) => {
    const [digits, setDigits] = useState([])

    const addDigit = (n) => {
        if (digits.length >= digitCount) return
        setDigits(prev => [...prev, n])
    }

    const removeLastDigit = () => {
        setDigits(prev => prev.slice(0, -1))
    }

    const handleConfirm = () => {
        if (digits.length !== digitCount) return
        onConfirm(digits)
    }

    // Slot sizing: use inline style for non-standard Tailwind sizes
    const slotStyle = digitCount <= 4
        ? { width: '4rem', height: '5rem', fontSize: '2rem' }
        : digitCount === 5
            ? { width: '3.5rem', height: '4.5rem', fontSize: '1.75rem' }
            : digitCount === 6
                ? { width: '2.8rem', height: '3.8rem', fontSize: '1.5rem' }
                : digitCount === 7
                    ? { width: '2.4rem', height: '3.2rem', fontSize: '1.25rem' }
                    : { width: '2rem', height: '2.8rem', fontSize: '1.1rem' }  // 8

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl border-b-8 border-green-700/30 w-full max-w-sm p-6 md:p-8 flex flex-col gap-5">

                {/* Title */}
                <div className="text-center">
                    <h2 className="bungee-font text-green-700 text-2xl">CHOOSE YOUR CODE</h2>
                    <p className="text-green-500 text-xs mt-1 tracking-widest">PICK {digitCount} DIGITS — THIS IS YOUR SECRET</p>
                </div>

                {/* Display slots */}
                <div className={`flex justify-center ${digitCount >= 7 ? 'gap-1' : 'gap-2'}`}>
                    {Array.from({ length: digitCount }).map((_, i) => (
                        <div
                            key={`slot-${i}`}
                            style={slotStyle}
                            className={`rounded-2xl border-4 flex items-center justify-center bungee-font transition-all flex-shrink-0 ${
                                digits[i] !== undefined
                                    ? 'bg-green-50 border-green-400 text-green-800'
                                    : 'bg-gray-50 border-gray-200 text-gray-300'
                            }`}
                        >
                            {digits[i] !== undefined ? digits[i] : '?'}
                        </div>
                    ))}
                </div>

                {/* Number Pad */}
                <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => (
                        <button
                            key={`btn-${n}`}
                            onClick={() => addDigit(n)}
                            disabled={digits.length >= digitCount}
                            className="aspect-square rounded-2xl bg-green-400 hover:bg-green-500 active:bg-green-600 text-white bungee-font text-2xl transition-all active:scale-90 shadow-[0_4px_0_0_#2e7d32] active:shadow-none active:translate-y-1 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {n}
                        </button>
                    ))}
                </div>

                {/* Backspace */}
                <button
                    onClick={removeLastDigit}
                    disabled={digits.length === 0}
                    className="w-full py-4 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-600 bungee-font text-xl transition-all disabled:opacity-40"
                >
                    ⌫ BACKSPACE
                </button>

                {/* Confirm / Cancel */}
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-4 rounded-2xl bg-white border-4 border-gray-200 text-gray-500 bungee-font text-lg hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all"
                    >
                        CANCEL
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={digits.length !== digitCount}
                        className="flex-1 py-4 rounded-2xl bg-[#FFC107] hover:bg-[#FFB300] text-[#5D4037] bungee-font text-lg shadow-[0_4px_0_0_#FFA000] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        ✅ LOCK IN
                    </button>
                </div>
            </div>
        </div>
    )
}

export default DigitPicker
