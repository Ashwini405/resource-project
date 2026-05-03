import { createContext, useContext, useReducer } from "react";

const MergeContext = createContext(null);

const initialState = {
  isProcessed: false,
  mergedData: [],
  unmatchedData: [],
  rawFiles: {
    file1: null,
    file2: null,
    file3: null,
  },
  mappings: null,
};

function mergeReducer(state, action) {
  switch (action.type) {
    case "SET_FILES":
      return {
        ...state,
        rawFiles: { ...state.rawFiles, ...action.payload },
      };
    case "SET_MERGED_RESULTS":
      return {
        ...state,
        isProcessed: true,
        mergedData: action.payload.mergedData,
        unmatchedData: action.payload.unmatchedData,
        mappings: action.payload.mappings,
      };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export function MergeProvider({ children }) {
  const [state, dispatch] = useReducer(mergeReducer, initialState);

  return (
    <MergeContext.Provider value={{ state, dispatch }}>
      {children}
    </MergeContext.Provider>
  );
}

export function useMergeContext() {
  const context = useContext(MergeContext);
  if (!context) {
    throw new Error("useMergeContext must be used within a MergeProvider");
  }
  return context;
}
