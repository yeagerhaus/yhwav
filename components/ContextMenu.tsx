import { type SFSymbol, SymbolView } from 'expo-symbols';
import React, { type ReactNode } from 'react';
import { Modal, Pressable, type StyleProp, TouchableOpacity, type View, type ViewStyle } from 'react-native';
import { Text } from '@/components/Text';
import { DefaultStyles } from '@/constants/styles';
import { useColors, useThemedStyles } from '@/hooks/useColors';
import { Div } from './Div';
export interface ContextMenuItem {
	label: string;
	systemImage?: SFSymbol;
	icon?: SFSymbol;
	onPress: () => void;
	destructive?: boolean;
	disabled?: boolean;
}

interface ContextMenuProps {
	items: ContextMenuItem[];
	children: ReactNode;
	style?: StyleProp<ViewStyle>;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ items, children, style }) => {
	const colors = useColors();
	const themed = useThemedStyles();
	const [visible, setVisible] = React.useState(false);
	const [position, setPosition] = React.useState({ x: 0, y: 0 });
	const triggerRef = React.useRef<View>(null);

	const handlePress = () => {
		if (triggerRef.current) {
			triggerRef.current.measure((_x, _y, _width, height, pageX, pageY) => {
				setPosition({
					x: pageX,
					y: pageY + height,
				});
				setVisible(true);
			});
		}
	};

	const handleItemPress = (item: ContextMenuItem) => {
		if (!item.disabled) {
			setVisible(false);
			item.onPress();
		}
	};

	return (
		<>
			<Pressable ref={triggerRef} onPress={handlePress} style={style}>
				{children}
			</Pressable>

			<Modal visible={visible} transparent animationType='fade' onRequestClose={() => setVisible(false)}>
				<TouchableOpacity style={themed.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
					<Div
						style={[
							themed.menuContainer,
							{
								top: position.y,
								right: 16,
							},
						]}
					>
						{items.map((item, index) => (
							<TouchableOpacity
								key={index}
								style={[
									DefaultStyles.menuItem,
									item.disabled && styles.menuItemDisabled,
									index !== items.length - 1 && themed.menuItemBorder,
								]}
								onPress={() => handleItemPress(item)}
								disabled={item.disabled}
							>
								<Div style={DefaultStyles.menuItemContent} transparent>
									{item.systemImage ? (
										<SymbolView
											name={item.systemImage}
											size={18}
											tintColor={item.destructive ? colors.dangerSolid : colors.text}
											style={styles.menuIcon}
										/>
									) : item.icon ? (
										<SymbolView
											name={item.icon}
											size={18}
											tintColor={item.destructive ? colors.dangerSolid : colors.text}
											style={styles.menuIcon}
										/>
									) : null}
									<Text
										type='body'
										colorVariant={item.destructive ? 'danger' : 'primary'}
										style={[item.disabled && styles.menuItemDisabledText]}
									>
										{item.label}
									</Text>
								</Div>
							</TouchableOpacity>
						))}
					</Div>
				</TouchableOpacity>
			</Modal>
		</>
	);
};

const styles = {
	menuIcon: {
		marginRight: 12,
	},
	menuItemDisabled: {
		opacity: 0.4,
	},
	menuItemDisabledText: {
		opacity: 0.4,
	},
} as const;
