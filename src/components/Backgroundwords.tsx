// src/components/BackgroundWords.tsx
'use client'

export default function BackgroundWords() {
  const motsCles = ['PARIS', 'VINTAGE', 'SLOW', 'UPCYCLING', 'LE MARAIS', 'RÉGÉNÉRÉ']

  return (
    <div 
      className="fixed top-0 right-0 pointer-events-none flex flex-col items-end pr-8 pt-4"
      style={{ zIndex: 1 }}
    >
      {motsCles.map((mot, i) => (
        <span 
          key={i}
          style={{ 
            fontSize: '120px',
            fontWeight: '700',
            lineHeight: '0.95',
            color: '#E8E8E8',
            letterSpacing: '-0.02em',
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
          }}
        >
          {mot}
        </span>
      ))}
    </div>
  )
}