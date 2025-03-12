import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Interest } from "@shared/schema";
import { MessageSquare } from "lucide-react";

interface MatchingScreenProps {
  interests: Interest[];
  onCancel: () => void;
}

const MatchingScreen: React.FC<MatchingScreenProps> = ({ interests, onCancel }) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen p-4 md:p-8 bg-gray-50" data-screen="matching">
      <Card className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 md:p-8 text-center">
        <div className="animate-pulse">
          <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
            <MessageSquare className="h-12 w-12 text-primary" />
          </div>
        </div>
        
        <h2 className="text-xl font-semibold mt-6 text-gray-800">Finding someone to chat with...</h2>
        
        {interests.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {interests.map(interest => (
              <span 
                key={interest}
                className="bg-secondary/10 text-secondary px-3 py-1 rounded-full text-sm"
              >
                {interest}
              </span>
            ))}
          </div>
        )}
        
        <div className="mt-8">
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-primary h-full rounded-full animate-[progress_2s_ease-in-out_infinite]" 
              style={{
                animation: "progress 2s ease-in-out infinite",
                width: "75%",
                "@keyframes progress": {
                  "0%": { width: "15%" },
                  "50%": { width: "85%" },
                  "100%": { width: "15%" }
                }
              }}
            ></div>
          </div>
        </div>
        
        <Button
          variant="outline"
          className="mt-8 border-primary text-primary hover:bg-gray-100"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </Card>
    </div>
  );
};

export default MatchingScreen;
