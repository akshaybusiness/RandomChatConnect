import React, { useState, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Interest, interests as popularInterests } from "@shared/schema";
import { X, ArrowRight } from "lucide-react";

interface WelcomeScreenProps {
  selectedInterests: Interest[];
  setSelectedInterests: (interests: Interest[]) => void;
  hasVideo: boolean;
  setHasVideo: (hasVideo: boolean) => void;
  onStartChat: () => void;
}

import { Video } from "lucide-react";

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  selectedInterests,
  setSelectedInterests,
  hasVideo,
  setHasVideo,
  onStartChat
}) => {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInterestInput = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      addInterest(inputValue.trim() as Interest);
      setInputValue("");
    }
  };

  const addInterest = (interest: Interest) => {
    if (!selectedInterests.includes(interest)) {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const removeInterest = (interest: Interest) => {
    setSelectedInterests(selectedInterests.filter(i => i !== interest));
  };

  const addPopularInterest = (interest: Interest) => {
    if (!selectedInterests.includes(interest)) {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen p-4 md:p-8" data-screen="welcome">
      <Card className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 md:p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary">AnonyChat</h1>
          <p className="text-gray-600 mt-2">Connect instantly with random people</p>
        </div>
        
        <div className="space-y-4 mt-8">
          <div>
            <label htmlFor="interests" className="block text-sm font-medium text-gray-700 mb-1">
              Your Interests (optional)
            </label>
            <div 
              className="mt-1 flex flex-wrap gap-2 p-2 border border-gray-300 rounded-lg"
              onClick={() => inputRef.current?.focus()}
            >
              {selectedInterests.map(interest => (
                <span 
                  key={interest}
                  className="bg-secondary/10 text-secondary px-3 py-1 rounded-full text-sm flex items-center"
                >
                  {interest}
                  <button
                    className="ml-2 text-secondary hover:text-primary"
                    onClick={() => removeInterest(interest)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </span>
              ))}
              <input 
                ref={inputRef}
                type="text" 
                id="interests" 
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                className="border-0 focus:ring-0 outline-none bg-transparent flex-grow min-w-[100px] text-sm" 
                placeholder="Type interest & press Enter" 
                onKeyDown={handleInterestInput}
              />
            </div>
          </div>
          
          <div className="pt-2">
            <p className="text-sm text-gray-600 mb-2">Popular interests:</p>
            <div className="flex flex-wrap gap-2">
              {popularInterests.slice(0, 8).map(interest => (
                <button 
                  key={interest}
                  className={`px-3 py-1 rounded-full text-sm transition-all ${
                    selectedInterests.includes(interest)
                      ? "bg-secondary/10 text-secondary"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                  onClick={() => addPopularInterest(interest)}
                  disabled={selectedInterests.includes(interest)}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>
          
          <div className="pt-4">
            <button
              type="button"
              onClick={() => setHasVideo(!hasVideo)}
              className={`w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-md border transition-all duration-200 ${
                hasVideo
                  ? "bg-primary/10 text-primary border-primary/30 font-medium"
                  : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
              }`}
            >
              <Video className={`h-5 w-5 ${hasVideo ? "text-primary" : "text-gray-600"}`} />
              <span>{hasVideo ? "Video Chat Enabled" : "Enable Video Chat"}</span>
            </button>
          </div>
        </div>
        
        <div className="pt-4">
          <Button
            className="w-full flex items-center justify-center space-x-2 transition-all duration-200 transform hover:scale-[1.02]"
            onClick={onStartChat}
          >
            <ArrowRight className="h-5 w-5" />
            <span>Start Chat</span>
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default WelcomeScreen;
