
import React, { useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';

interface AIAssistantProps {
  onSuggestSet: (name: string, sounds: { name: string, description: string }[]) => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ onSuggestSet }) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const generateShowIdeas = async () => {
    if (!prompt.trim()) return;
    setLoading(true);

    try {
      // Initialize Gemini API with API key from environment variable
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `I am producing a podcast/show titled "${prompt}". Suggest a list of 8 specific sound effects or music cues that would fit this atmosphere. Provide the name of the sound and a short description.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              setName: { type: Type.STRING },
              sounds: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING }
                  },
                  required: ["name", "description"]
                }
              }
            },
            required: ["setName", "sounds"]
          }
        }
      });

      // Extract generated text directly from the .text property (not a method)
      const jsonStr = response.text?.trim() || '{}';
      const data = JSON.parse(jsonStr);
      
      if (data.setName && data.sounds) {
        onSuggestSet(data.setName, data.sounds);
      }
      setPrompt('');
    } catch (error) {
      console.error('AI Error:', error);
      alert('Failed to get AI suggestions. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
      <h3 className="text-sm font-bold text-blue-400 mb-3 uppercase tracking-wider flex items-center gap-2">
        <i className="fa-solid fa-wand-magic-sparkles"></i>
        AI Show Planner
      </h3>
      <div className="flex gap-2">
        <input 
          type="text" 
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Spooky Horror Podcast"
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <button 
          onClick={generateShowIdeas}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
        >
          {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Plan'}
        </button>
      </div>
      <p className="text-[10px] text-slate-500 mt-2">
        Gemini will suggest a custom soundboard layout for your show topic.
      </p>
    </div>
  );
};
