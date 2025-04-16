import React from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import styled from "styled-components";
import { Phase } from "../../types/phase";
import PhaseStatusIndicator from "./PhaseStatusIndicator";

const PhaseListContainer = styled.div`
  width: 100%;
  max-width: 800px;
  margin: 20px auto;
`;

const PhaseItem = styled.div`
  display: flex;
  align-items: center;
  padding: 15px;
  margin: 10px 0;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  cursor: grab;
`;

interface PhaseListProps {
  phases: Phase[];
  onPhaseReorder: (startIndex: number, endIndex: number) => void;
  onPhaseSelect: (phase: Phase) => void;
}

export const PhaseList: React.FC<PhaseListProps> = ({
  phases,
  onPhaseReorder,
  onPhaseSelect,
}) => {
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    onPhaseReorder(result.source.index, result.destination.index);
  };

  return (
    <PhaseListContainer>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="phase-list">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {phases.map((phase, index) => (
                <Draggable key={phase.id} draggableId={phase.id} index={index}>
                  {(provided) => (
                    <PhaseItem
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      onClick={() => onPhaseSelect(phase)}
                    >
                      <PhaseStatusIndicator status={phase.status} />
                      <div style={{ marginLeft: "15px" }}>
                        <h3>{phase.name}</h3>
                        <p>{phase.template?.name || "No template selected"}</p>
                      </div>
                    </PhaseItem>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </PhaseListContainer>
  );
};

export default PhaseList;
