1. 산출물  
   [deck-src.html](gpt56-terra/deck-src.html) 24,021 bytes  
   [deck.html](gpt56-terra/deck.html) 176,705 bytes

2. 구성  
   6슬라이드, 장면 상태 22개, 슬라이드별 최대 step은 `2/4/3/3/2/2`, 전체 최대 4입니다. 노드 52개, 엣지 12개입니다.

3. 검증  
   `static-check.py deck.html` 결과 `pass:true`, 오류와 경고 모두 0입니다. 브라우저에서도 콘솔 error/warning 0, 전 슬라이드 품질 스니펫 통과, → 끝까지 진행 및 ← 역방향에서 focus·flow·여정 view 복원을 확인했습니다. 편집 모드 ⌘E 왕복도 장면 전체 공개, 카메라 해제, 현재 장면 복원으로 통과했습니다.

4. 사용 기능  
   `data-step` 단일값 및 `2-3` 범위, `focus` 줌인과 딤, `flow`, `pulse`, `reset`, `view`를 사용했습니다. 전환은 `rise`, `flow`, `zoom-in`, `zoom-out`입니다. `2200x720` 여정형 캔버스는 step 0 시작 뷰, 전체 줌아웃, 오른쪽 팬으로 구성했습니다.

5. 어려웠던 점  
   넓은 캔버스가 축소될 때 글자가 작아지는 문제를 고려해 여정 슬라이드 글자를 28px 이상으로 설계했습니다. 품질 검사에서 해당 슬라이드도 최소 15.1px, 채움률 85%로 통과했습니다.
