"use client";

import { useMemo, useState } from "react";

const INITIAL = [0, 0, 1, 1, 0, 0, 1, 1] as const;

export function SkipperLab() {
  const [column, setColumn] = useState<number[]>([...INITIAL]);
  const transitions = useMemo(
    () => column.slice(1).reduce((count, cell, index) => count + Number(cell !== column[index]), 0),
    [column],
  );
  const thirdAt = useMemo(() => {
    let count = 0;
    for (let i = 1; i < column.length; i += 1) {
      if (column[i] !== column[i - 1]) count += 1;
      if (count === 3) return i;
    }
    return -1;
  }, [column]);
  const skipped = transitions > 2;

  return (
    <figure className="blog-lab" aria-labelledby="skipper-title">
      <div className="blog-lab-heading">
        <div>
          <p className="blog-kicker">First and last column skipper</p>
          <h3 id="skipper-title">Find the third transition, then jump</h3>
        </div>
        <button className="blog-reset-link" type="button" onClick={() => setColumn([...INITIAL])}>Reset example</button>
      </div>
      <div className="skipper-layout">
        <div className="skipper-column" aria-label="Editable edge column">
          {column.map((cell, index) => (
            <button
              key={index}
              type="button"
              className={cell ? "is-black" : "is-white"}
              aria-label={`Row ${index + 1}, ${cell ? "black" : "white"}`}
              data-third={index === thirdAt}
              onClick={() => setColumn((current) => current.map((item, i) => (i === index ? 1 - item : item)))}
            />
          ))}
        </div>
        <div className="skipper-readout" aria-live="polite">
          <p><span>Transitions</span><strong>{transitions}</strong></p>
          <p><span>Decision</span><strong className={skipped ? "text-red-700" : "text-green-700"}>{skipped ? "Skip range" : "Keep scanning"}</strong></p>
          <p className="skipper-note">
            {skipped
              ? `The third transition appears at row ${thirdAt + 1}. Every candidate with this fixed prefix can be skipped together.`
              : "This edge still has at most two transitions, so the prefix remains possible."}
          </p>
        </div>
      </div>
      <figcaption>Click any cell. The outlined cell marks the third color transition when one exists.</figcaption>
    </figure>
  );
}
