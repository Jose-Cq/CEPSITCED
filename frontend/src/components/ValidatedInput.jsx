import React, { useState } from 'react';

const ValidatedInput = ({ placeholder, required, type, value, onChange, onInput, className, error, helpText }) => {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="relative w-full">
      <input
        type={isPassword && show ? 'text' : type}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={onChange}
        onInput={onInput}
        className={`${className} ${error ? 'border-red-500' : 'border-gray-100'} transition-colors duration-200`}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#003178] transition-colors"
        >
          <span className="material-symbols-outlined text-sm notranslate" translate="no">
            {show ? 'visibility_off' : 'visibility'}
          </span>
        </button>
      )}
      {error && <p className="text-[10px] text-red-500 mt-1 ml-2 font-bold">{error}</p>}
      {!error && helpText && <p className="text-[10px] text-gray-400 mt-1 ml-2 leading-tight">{helpText}</p>}
    </div>
  );
};

export default ValidatedInput;