// frontend/script.js

let net; // PoseNet 모델
let clothingEntity; // A-Frame의 a-image 엔티티

// 페이지가 로드되면 자동으로 AR 시작
window.addEventListener('load', () => {
  startAR();
});

// frontend/script.js

async function startAR() {
  console.log('AR 시작됨');

  // AR 버튼 숨기기
  const arButton = document.getElementById('ar-button');
  if (arButton) {
    arButton.style.display = 'none';
  }
  
  // 비디오 요소 설정
  const video = document.getElementById('video');
  video.style.display = 'block';
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'user',
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }, 
      audio: false 
    });
    video.srcObject = stream;
    video.play();
  } catch (error) {
    console.error('카메라 접근 실패:', error);
    alert('카메라에 접근할 수 없습니다.');
    return;
  }

  // PoseNet 모델 로드
  try {
    net = await posenet.load();
    console.log('PoseNet 모델 로드 완료');
  } catch (error) {
    console.error('PoseNet 모델 로드 실패:', error);
    alert('PoseNet 모델을 로드할 수 없습니다.');
    return;
  }

  // PoseNet을 사용하여 신체 포인트 감지 시작
  detectPose();

  // 촬영 버튼 표시
  const captureButton = document.getElementById('capture-button');
  if (captureButton) {
    captureButton.style.display = 'block';
  }
}


// PoseNet을 사용하여 신체 포인트 감지
async function detectPose() {
  console.log('detectPose 함수 호출됨');
  const video = document.getElementById('video');
  clothingEntity = document.getElementById('clothing');

  // URL에서 product_id 추출
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('product_id');

  if (!productId) {
    console.error('Product ID not found in URL.');
    return;
  }

  try {
    console.log('Fetching product data...');
    // 백엔드 API에서 제품 정보 가져오기
    const response = await fetch(`https://polochip-27938865dd00.herokuapp.com/api/products/${productId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const product = await response.json();

    if (product.error) {
      console.error(product.error);
      return;
    }

    // 옷 이미지 설정
    clothingEntity.setAttribute('src', product.imageUrl);
    console.log('Product data fetched successfully:', product);
  } catch (error) {
    console.error('Error fetching product data:', error);
    alert('제품 정보를 가져오는 데 실패했습니다.');
    return;
  }

  async function poseDetectionFrame() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      try {
        // PoseNet을 사용하여 포즈 추정
        const pose = await net.estimateSinglePose(video, {
          flipHorizontal: true
        });

        // 어깨 포인트 추출
        const leftShoulder = pose.keypoints.find(k => k.part === 'leftShoulder');
        const rightShoulder = pose.keypoints.find(k => k.part === 'rightShoulder');

        if (leftShoulder.score > 0.5 && rightShoulder.score > 0.5) {
          // 중앙 어깨 위치 계산
          const centerX = (leftShoulder.position.x + rightShoulder.position.x) / 2;
          const centerY = (leftShoulder.position.y + rightShoulder.position.y) / 2;

          // 화면 크기 가져오기
          const screenWidth = window.innerWidth;
          const screenHeight = window.innerHeight;

          // 중앙 좌표를 -1 ~ 1 범위로 변환 (A-Frame 좌표계에 맞춤)
          const aframeX = (centerX / screenWidth) * 2 - 1;
          const aframeY = -(centerY / screenHeight) * 2 + 1;

          // A-Frame 씬에서 카메라의 월드 좌표 가져오기
          const scene = document.querySelector('a-scene');
          const camera = scene.camera;

          // 중앙 좌표를 3D 공간으로 변환
          const vector = new THREE.Vector3(aframeX, aframeY, -1).unproject(camera);

          // 옷 이미지의 위치 설정 (Z 축을 -3으로 고정)
          clothingEntity.setAttribute('position', `${vector.x} ${vector.y} -3`);
        }
      } catch (error) {
        console.error('Pose estimation error:', error);
      }
    }

    // 다음 프레임 요청
    requestAnimationFrame(poseDetectionFrame);
  }

  poseDetectionFrame();
}


// 촬영 버튼 클릭 시 호출되는 함수
function capturePhoto() {
  console.log('사진 촬영 버튼 클릭됨');

  const scene = document.querySelector('a-scene');
  if (!scene) {
    console.error('A-Frame scene not found.');
    return;
  }

  // 스크린샷 컴포넌트 사용
  scene.components.screenshot.capture('perspective', { width: window.innerWidth, height: window.innerHeight }, (dataURL) => {
    // 다운로드 링크 생성
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'ar_photo.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('사진이 성공적으로 저장되었습니다.');
    alert('사진이 갤러리에 저장되었습니다.');
  });
}
