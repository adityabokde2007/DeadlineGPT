import React, { useState, useEffect } from 'react';

const STATEMENTS = [
  "Never Miss Your Deadline.",
  "Plan Smarter. Finish Faster.",
  "Your AI Partner for Every Deadline."
];

export default function TypewriterHeading() {
  const [text, setText] = useState("");
  const [statementIndex, setStatementIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timer: number;
    const currentStatement = STATEMENTS[statementIndex];

    if (!isDeleting && text === currentStatement) {
      // Pause after full typing
      timer = window.setTimeout(() => setIsDeleting(true), 2000);
    } else if (isDeleting && text === "") {
      // Move to next statement
      setIsDeleting(false);
      setStatementIndex((prev) => (prev + 1) % STATEMENTS.length);
    } else {
      // Typing or erasing
      const timeoutTime = isDeleting ? 40 : 100; 
      timer = window.setTimeout(() => {
        setText(currentStatement.substring(0, text.length + (isDeleting ? -1 : 1)));
      }, timeoutTime);
    }

    return () => clearTimeout(timer);
  }, [text, isDeleting, statementIndex]);

  return (
    <h1 className="relative grid text-5xl md:text-6xl font-bold tracking-tighter text-on-surface max-w-4xl mb-6 mx-auto w-full text-center">
      {/* Invisible placeholder to reserve space for the longest text so height never changes */}
      <span className="invisible col-start-1 row-start-1" aria-hidden="true">
        Your AI Partner for Every Deadline.
      </span>
      
      {/* Actual typing text positioned in the same grid cell */}
      <span className="col-start-1 row-start-1 block h-full w-full break-words">
        {text}
        {/* Cursor */}
        <span 
          className="inline-block w-[4px] h-[0.9em] bg-on-surface ml-[2px] align-middle"
          style={{
            animation: "blink 1s step-end infinite"
          }}
        />
      </span>
    </h1>
  );
}
